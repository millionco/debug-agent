import { EXCLUDED_ARIA_ROLE } from "../constants";

export interface ParsedAriaLine {
  role: string;
  name: string;
}

const ARIA_LINE_REGEX = /- (\w+)\s*(?:"((?:[^"\\]|\\.)*)")?/;

export const parseAriaLine = (line: string): ParsedAriaLine | undefined => {
  const match = ARIA_LINE_REGEX.exec(line);
  if (!match) return undefined;

  const role = match[1];
  if (role === EXCLUDED_ARIA_ROLE) return undefined;

  const name = match[2]?.replace(/\\(.)/g, "$1") ?? "";
  return { role, name };
};
