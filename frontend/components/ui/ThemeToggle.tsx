"use client";

import { useEffect, useState } from "react";
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
    <button
      type="button"
      className="icon-btn"
      onClick={toggleTheme}
      title={theme === "dark" ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
      aria-label={theme === "dark" ? "Light Mode aktivieren" : "Dark Mode aktivieren"}
    >
      <Icon name={theme === "dark" ? "spark" : "clock"} size={15} />
    </button>
  );
}