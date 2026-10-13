/**
 * ReidXtreme 5.0 — team registration receiver.
 *
 * Paste this into Extensions → Apps Script of the registrations Google Sheet,
 * set the SECRET script property, and deploy as a web app. See
 * docs/registration-setup.md for the full guide.
 *
 * The Next.js route /api/register POSTs JSON here:
 *   { secret, teamName, teamSize, leader: Member, members: Member[] }
 *   Member = { name, year, whatsapp, registrationNumber, ieeeMembership }
 */

const SHEET_NAME = 'Registrations';
const MAX_MEMBERS = 4;
const TIMEZONE = 'Asia/Colombo';
const MEMBER_FIELDS = [
  ['Name', 'name'],
  ['Year', 'year'],
  ['WhatsApp', 'whatsapp'],
  ['Reg No', 'registrationNumber'],
  ['IEEE No', 'ieeeMembership'],
];

function buildHeaders() {
  const headers = ['Timestamp', 'Team ID', 'Team Name', 'Team Size'];
  for (let i = 1; i <= MAX_MEMBERS; i++) {
    const who = i === 1 ? 'Leader' : 'Member ' + i;
    MEMBER_FIELDS.forEach(([label]) => headers.push(who + ' ' + label));
  }
  return headers;
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

  // Serialize writes so two simultaneous submissions can't both pass the
  // duplicate checks or land on the same row.
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return json({ ok: false, error: 'The server is busy. Please try again.' });
  }

  try {
    const sheet = getSheet();
    const headers = buildHeaders();
    const lastRow = sheet.getLastRow();
    const existing =
      lastRow > 1 ? sheet.getRange(2, 1, lastRow - 1, headers.length).getValues() : [];

    // Reject a team name or a registration number that is already registered.
    const teamName = String(data.teamName).trim();
    const takenNames = new Set(existing.map((row) => String(row[2]).trim().toLowerCase()));
    if (takenNames.has(teamName.toLowerCase())) {
      return json({ ok: false, error: 'That team name is already taken.' });
    }

    const regColumns = [];
    for (let i = 0; i < MAX_MEMBERS; i++) regColumns.push(4 + i * MEMBER_FIELDS.length + 3);
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

    const teamId = 'RX5-' + String(lastRow).padStart(3, '0');
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

    return json({ ok: true, teamId: teamId });
  } finally {
    lock.releaseLock();
  }
}

// Optional: run once from the editor to create the header row up front.
function setup() {
  getSheet();
}
