"use client";

import { useRef, useState } from "react";
import Link from "next/link";

type SourceActionLinkProps = {
  href: string;
  label?: string;
  external?: boolean;
  className?: string;
};

export function SourceActionLink({
  href,
  label = "OPEN SOURCE",
  external = true,
  className = ""
}: SourceActionLinkProps) {
  const [display, setDisplay] = useState(label);
  const runRef = useRef(0);

  const scramble = () => {
    const run = ++runRef.current;
    const glyphs = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
    let frame = 0;

    const tick = () => {
      if (run !== runRef.current) return;
      frame += 1;
      const progress = frame / 8;
      setDisplay(
        Array.from(label)
          .map((character, index) => {
            if (character === " " || index / label.length < progress) return character;
            return glyphs[(index * 5 + frame * 13) % glyphs.length];
          })
          .join("")
      );
      if (frame < 8) window.setTimeout(tick, 34);
      else setDisplay(label);
    };

    tick();
  };

  const classes = `source-action-link ${className}`.trim();
  const content = <span>{display}</span>;

  return external ? (
    <a
      className={classes}
      href={href}
      target="_blank"
      rel="noreferrer"
      onMouseEnter={scramble}
      onFocus={scramble}
    >
      {content}
    </a>
  ) : (
    <Link className={classes} href={href} onMouseEnter={scramble} onFocus={scramble}>
      {content}
    </Link>
  );
}
