"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "motion/react";
import { usePathname } from "next/navigation";
import { TransitionOverlay } from "@/components/TransitionOverlay";

let hasAppLoaded = false;

export default function Template({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Track whether THIS instance of the template was created during the initial load
  const isInitialInstance = useRef(!hasAppLoaded);
  const initialPathname = useRef(pathname);
  
  const [isTransitioning, setIsTransitioning] = useState(() => {
    return hasAppLoaded; // true on route changes, false on first load
  });

  useEffect(() => {
    // Force scroll to top instantly on route change
    window.scrollTo(0, 0);

    // If it's the initial instance AND the pathname hasn't changed since it mounted,
    // skip the transition. This check perfectly survives React 18 Strict Mode double-mounts.
    if (isInitialInstance.current && pathname === initialPathname.current) {
      hasAppLoaded = true;
      return;
    }

    // Otherwise, it's a route change. Trigger the transition!
    setIsTransitioning(true);

    // Strict minimum 2-second (2000ms) delay
    const timer = setTimeout(() => {
      setIsTransitioning(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, [pathname]);

  return (
    <>
      {/* Video Overlay */}
      <TransitionOverlay show={isTransitioning} />

      {/* Page Content */}
      <motion.div
        initial={{ filter: "brightness(0.2) blur(10px)", scale: 0.98 }}
        animate={{
          filter: isTransitioning ? "brightness(0.2) blur(10px)" : "brightness(1) blur(0px)",
          scale: isTransitioning ? 0.98 : 1,
        }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="min-h-screen w-full origin-top"
      >
        {children}
      </motion.div>
    </>
  );
}
