"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Icon from "./Icon";

type Theme = "dark" | "light";

export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("dark");

  useEffect(() => {
    const saved = localStorage.getItem("theme") as Theme | null;
    const initialTheme: Theme = saved === "light" ? "light" : "dark";
    setTheme(initialTheme);
    document.documentElement.dataset.theme = initialTheme;
  }, []);

  function toggleTheme() {
    const nextTheme: Theme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("theme", nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }

  return (
    <motion.button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92, rotate: 15 }}
      title={theme === "dark" ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
      aria-label={theme === "dark" ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={theme}
          initial={{ opacity: 0, rotate: -90, scale: 0.5 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          exit={{ opacity: 0, rotate: 90, scale: 0.5 }}
          transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
        >
          <Icon name={theme === "dark" ? "spark" : "clock"} size={15} />
        </motion.span>
      </AnimatePresence>
    </motion.button>
  );
}