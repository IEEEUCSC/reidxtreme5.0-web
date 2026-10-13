/**
 * ReidXtreme 5.0 — team registration receiver.
 *
 * Paste this into Extensions → Apps Script of the registrations Google Sheet,
 * set the SECRET script property, and deploy as a web app. See docs/registration-setup.md for the full guide.
 *
 * The Next.js route /api/register POSTs JSON here:
 *   { secret, teamName, teamSize, leader: Member, members: Member[] }
 *   Member = { name, year, email, whatsapp, registrationNumber, ieeeMembership }
 *
 * After a team is saved, the leader is emailed the welcome message.
 */

const SHEET_NAME = 'Registrations';
const MAX_MEMBERS = 3;
const TIMEZONE = 'Asia/Colombo';
const MEMBER_FIELDS = [
  ['Name', 'name'],
  ['Year', 'year'],
  ['Email', 'email'],
  ['WhatsApp', 'whatsapp'],
  ['Reg No', 'registrationNumber'],
  ['IEEE No', 'ieeeMembership'],
];
const REG_FIELD_INDEX = MEMBER_FIELDS.findIndex(([, key]) => key === 'registrationNumber');

const WHATSAPP_GROUP_URL = 'https://chat.whatsapp.com/DF2IqOjy4OfFW4SZfcN5JC?s=cl&p=i&mlu=0';
const MAIL_SENDER_NAME = 'ReidXtreme 5.0';
const MAIL_SUBJECT = 'Welcome to ReidXtreme 5.0!';
// Hero banner, shared publicly on Drive. lh3.googleusercontent.com serves the
// raw image so mail clients can load it like any hosted image.
const HERO_IMAGE_URL = 'https://lh3.googleusercontent.com/d/1dnMS6zspHcHieA1xwTj9zHomvQQOK2bq=w1200';

const memberLabel = (i) => (i === 1 ? 'Leader' : 'Member ' + i);

function buildHeaders() {
  const headers = ['Timestamp', 'Team ID', 'Team Name', 'Team Size'];
  for (let i = 1; i <= MAX_MEMBERS; i++) {
    MEMBER_FIELDS.forEach(([label]) => headers.push(memberLabel(i) + ' ' + label));
  }
  return headers;
}

// True when the sheet's header row is in the expected layout. A header may
// carry a note after the expected name, e.g. "Team ID (Auto Generated)".
function headersMatch(sheet) {
  const expected = buildHeaders();
  if (sheet.getLastColumn() < expected.length) return false;
  const actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0];
  return expected.every((header, i) => String(actual[i]).trim().startsWith(header));
}

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    const headers = buildHeaders();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function json(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'Invalid request.' });
  }

  const secret = PropertiesService.getScriptProperties().getProperty('SECRET');
  if (!secret || data.secret !== secret) {
    return json({ ok: false, error: 'Unauthorized.' });
  }

  const people = [data.leader].concat(data.members || []);
  const teamName = String(data.teamName).trim();
  let teamId;

  // Serialize writes so two simultaneous submissions can't both pass the
  // duplicate checks or land on the same row.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return json({ ok: false, error: 'The server is busy. Please try again.' });
  }

  try {
    const sheet = getSheet();
    const headers = buildHeaders();
    if (!headersMatch(sheet)) {
      // The sheet still has the old layout; writing now would shift columns.
      console.error('Header row does not match. Run migrateAddEmailColumns() from the editor.');
      return json({ ok: false, error: 'Registrations are being updated. Please try again shortly.' });
    }

    const lastRow = sheet.getLastRow();
    const existing =
      lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];

    // Reject a team name or a registration number that is already registered.
    const takenNames = new Set(existing.map((row) => String(row[2]).trim().toLowerCase()));
    if (takenNames.has(teamName.toLowerCase())) {
      return json({ ok: false, error: 'That team name is already taken.' });
    }

    const regColumns = [];
    for (let i = 0; i < MAX_MEMBERS; i++) {
      regColumns.push(4 + i * MEMBER_FIELDS.length + REG_FIELD_INDEX);
    }
    const takenRegs = new Set();
    existing.forEach((row) =>
      regColumns.forEach((col) => row[col] && takenRegs.add(String(row[col]).toUpperCase())),
    );
    const clash = people.find((p) => takenRegs.has(String(p.registrationNumber).toUpperCase()));
    if (clash) {
      return json({
        ok: false,
        error: 'Registration number ' + clash.registrationNumber + ' is already in another team.',
      });
    }

    teamId = 'RX5-' + String(lastRow).padStart(3, '0');
    const row = [
      Utilities.formatDate(new Date(), TIMEZONE, 'yyyy-MM-dd HH:mm:ss'),
      teamId,
      teamName,
      String(people.length),
    ];
    for (let i = 0; i < MAX_MEMBERS; i++) {
      const person = people[i] || {};
      MEMBER_FIELDS.forEach(([, key]) => row.push(person[key] ? String(person[key]) : ''));
    }

    // Plain-text format keeps leading zeros in phone numbers and stops values
    // starting with "=" or "+" from being treated as formulas.
    sheet
      .getRange(lastRow + 1, 1, 1, row.length)
      .setNumberFormat('@')
      .setValues([row]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }

  // The team is saved at this point, so a mail failure must not fail the
  // registration. Failures show up under Apps Script → Executions.
  try {
    sendWelcomeEmail(data.leader, teamName);
  } catch (err) {
    console.error('Welcome email to ' + data.leader.email + ' failed: ' + err);
  }

  return json({ ok: true, teamId: teamId });
}

// ── Welcome email ────────────────────────────────────────────────────────────

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sendWelcomeEmail(leader, teamName) {
  MailApp.sendEmail(leader.email, MAIL_SUBJECT, buildWelcomeText(teamName), {
    name: MAIL_SENDER_NAME,
    htmlBody: buildWelcomeHtml(teamName),
  });
}

// Plain-text fallback for clients that don't render HTML.
function buildWelcomeText(teamName) {
  return [
    'WELCOME TO REIDXTREME 5.0!',
    '',
    'Team: ' + teamName,
    '',
    'Dear Participants,',
    '',
    'Congratulations! Your team has successfully registered for ReidXtreme 5.0!',
    '',
    'Get ready to challenge your limits, sharpen your problem-solving skills, and take your ' +
      'competitive programming journey to the next level as you prepare for IEEEXtreme 20.0!',
    '',
    'JOIN OUR OFFICIAL WHATSAPP GROUP',
    'All team members are required to join the official WhatsApp group to receive competition ' +
      'updates, announcements, and important instructions.',
    'Join here: ' + WHATSAPP_GROUP_URL,
    '',
    'The challenge awaits. Let your ascent begin!',
    '',
    'Best regards,',
    'Organizing Committee',
    'ReidXtreme 5.0',
    'IEEE Student Branch of UCSC',
  ].join('\n');
}

// Table layout and inline styles only, so it renders the same in Gmail,
// Outlook and Apple Mail. Colours follow DESIGN.md: dark chasm background,
// glass panel, mint accents, condensed uppercase display type, and the home
// page's 40px technical grid behind everything (clients that drop CSS
// gradients just show the plain background).
function buildWelcomeHtml(teamName) {
  const c = {
    bg: '#03080A',
    panel: '#07120F',
    line: '#1F4A39', // --line (mint at 35%) flattened onto the panel
    mint: '#8CF5BD',
    emerald: '#3FB57F',
    white: '#F5FAF7',
    body: '#D6E4DC',
    muted: '#A9C2B5',
  };
  const display =
    "font-family:'Barlow Condensed','Arial Narrow',Arial,sans-serif;text-transform:uppercase;";
  const sans = "font-family:Inter,'Segoe UI',Helvetica,Arial,sans-serif;";
  const eyebrow =
    sans + 'margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:0.12em;' +
    'text-transform:uppercase;color:' + c.mint + ';';
  const h2 =
    display + 'margin:0 0 10px;font-size:22px;font-weight:700;letter-spacing:0.04em;color:' +
    c.white + ';';
  const p = sans + 'margin:0 0 16px;font-size:15px;line-height:1.65;color:' + c.body + ';';
  const section =
    'padding:22px 24px;background-color:' + c.bg + ';border:1px solid ' + c.line +
    ';border-radius:8px;';
  const grid =
    'background-color:' + c.bg + ';background-image:' +
    'linear-gradient(rgba(140,245,189,0.05) 1px,transparent 1px),' +
    'linear-gradient(90deg,rgba(140,245,189,0.05) 1px,transparent 1px);' +
    'background-size:40px 40px;';

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${MAIL_SUBJECT}</title>
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;700&family=Inter:wght@400;600&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background-color:${c.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your team ${escapeHtml(teamName)} is registered. Join the official WhatsApp group to stay updated.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${grid}">
<tr><td align="center" style="padding:32px 16px;${grid}">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:600px;">

    <tr><td style="padding:0 4px 20px;">
      <p style="${eyebrow}margin:0;">IEEE Student Branch of UCSC</p>
    </td></tr>

    <tr><td style="background-color:${c.panel};border:1px solid ${c.line};border-radius:10px;overflow:hidden;padding:0;">

      <img src="${HERO_IMAGE_URL}" width="600" alt="ReidXtreme 5.0" style="display:block;width:100%;max-width:600px;height:auto;border:0;border-bottom:1px solid ${c.line};border-radius:10px 10px 0 0;">

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
      <tr><td style="padding:32px 32px 36px;">

      <p style="${eyebrow}">ReidXtreme 5.0 · Team registration</p>
      <h1 style="${display}margin:0 0 24px;font-size:44px;line-height:0.95;font-weight:700;letter-spacing:0.025em;color:${c.white};">
        Welcome to <span style="color:${c.mint};text-shadow:0 0 18px rgba(140,245,189,0.45);">ReidXtreme 5.0!</span>
      </h1>

      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr>
          <td style="padding:10px 16px;border:1px solid ${c.line};border-radius:6px;background-color:${c.bg};">
            <span style="${sans}font-size:11px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${c.muted};">Team</span><br>
            <span style="${display}font-size:20px;font-weight:700;letter-spacing:0.04em;color:${c.white};">${escapeHtml(teamName)}</span>
          </td>
        </tr>
      </table>

      <p style="${p}">Dear Participants,</p>
      <p style="${p}"><strong style="color:${c.white};">Congratulations!</strong> Your team has successfully registered for ReidXtreme 5.0!</p>
      <p style="${p}margin-bottom:28px;">Get ready to challenge your limits, sharpen your problem-solving skills, and take your competitive programming journey to the next level as you prepare for <strong style="color:${c.mint};">IEEEXtreme 20.0</strong>!</p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 32px;">
        <tr><td style="${section}">
          <h2 style="${h2}">Join our official WhatsApp group</h2>
          <p style="${p}margin-bottom:20px;">All team members are required to join the official WhatsApp group to receive competition updates, announcements, and important instructions.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr><td style="border-radius:6px;background-color:${c.mint};box-shadow:0 0 22px rgba(140,245,189,0.35);">
              <a href="${WHATSAPP_GROUP_URL}" target="_blank" style="${display}display:inline-block;padding:12px 26px;font-size:16px;font-weight:700;letter-spacing:0.08em;color:${c.bg};text-decoration:none;">Join the group &rarr;</a>
            </td></tr>
          </table>
          <p style="${sans}margin:14px 0 0;font-size:12px;line-height:1.5;color:${c.muted};word-break:break-all;">Or open: <a href="${WHATSAPP_GROUP_URL}" style="color:${c.mint};">${WHATSAPP_GROUP_URL}</a></p>
        </td></tr>
      </table>

      <p style="${display}margin:0 0 32px;font-size:24px;line-height:1.15;font-weight:700;letter-spacing:0.04em;color:${c.white};">
        The challenge awaits. <span style="color:${c.mint};">Let your ascent begin!</span>
      </p>

      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
        <tr><td style="border-top:1px solid ${c.line};padding-top:22px;">
          <p style="${sans}margin:0 0 8px;font-size:14px;color:${c.muted};">Best regards,</p>
          <p style="${sans}margin:0;font-size:14px;line-height:1.6;color:${c.body};">
            <strong style="color:${c.white};">Organizing Committee</strong><br>
            ReidXtreme 5.0<br>
            IEEE Student Branch of UCSC
          </p>
        </td></tr>
      </table>

      </td></tr>
      </table>

    </td></tr>

    <tr><td align="center" style="padding:20px 8px 0;">
      <p style="${sans}margin:0;font-size:12px;line-height:1.5;color:${c.muted};">You're receiving this because you registered a team for ReidXtreme 5.0 as its leader.</p>
    </td></tr>

  </table>
</td></tr>
</table>
</body>
</html>`;
}

// ── Editor-only functions ───────────────────────────────────────────────────

// Run once from the editor to create the header row up front.
function setup() {
  getSheet();
}

// Run once from the editor to upgrade a sheet created before emails were
// collected. Inserts an "<who> Email" column after each "<who> Year" column
// and leaves existing rows blank there. Safe to run more than once.
function migrateAddEmailColumns() {
  const sheet = getSheet();
  for (let i = 1; i <= MAX_MEMBERS; i++) {
    const who = memberLabel(i);
    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    if (headers.indexOf(who + ' Email') !== -1) continue;
    const yearIndex = headers.indexOf(who + ' Year');
    if (yearIndex === -1) throw new Error('Could not find the "' + who + ' Year" column.');

    const column = yearIndex + 2; // 1-based, right after the Year column
    sheet.insertColumnAfter(yearIndex + 1);
    sheet.getRange(1, column).setValue(who + ' Email').setFontWeight('bold');
    sheet.getRange(1, column, sheet.getMaxRows(), 1).setNumberFormat('@');
  }

  if (!headersMatch(sheet)) {
    const actual = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    throw new Error(
      'Header row differs from the expected layout.\nExpected: ' + buildHeaders().join(', ') +
        '\nFound: ' + actual.join(', '),
    );
  }
  console.log('Email columns are in place.');
}

// Run from the editor to preview the welcome email in your own inbox.
function sendTestWelcomeEmail() {
  sendWelcomeEmail({ email: Session.getActiveUser().getEmail() }, 'Test Team');
}
