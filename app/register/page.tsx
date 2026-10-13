import { SiteNav } from "@/components/nav/SiteNav";
import Footer from "@/components/Footer";
import RegistrationForm from "@/components/RegistrationForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Register - REID XTREME 5.0",
};

export default function RegisterPage() {
  return (
    <>
      <SiteNav />
      <main className="w-full">
        {/* The body already draws the grid; this adds only the glow from above. */}
        <div className="grid min-h-screen pt-[clamp(6rem,15vh,10rem)] pb-16 [place-items:safe_center] p-3 sm:p-[clamp(1rem,5vw,3rem)]">
          <RegistrationForm isOpen={process.env.REGISTRATIONS_OPEN === "true"} />
        </div>
      </main>
      <div className="px-4 pt-4 md:px-[clamp(1rem,5vw,4.5rem)] md:pt-[clamp(1rem,5vw,4.5rem)]">
        <Footer />
      </div>
    </>
  );
}
