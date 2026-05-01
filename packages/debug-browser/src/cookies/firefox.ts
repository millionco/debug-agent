import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parse as parseIni } from "ini";
import { z } from "zod";
import { FIREFOX_CONFIG } from "./browser-config";
import { ListBrowsersError } from "./errors";
import { Browsers } from "./browser-detector";
import { makeFirefoxBrowser, type FirefoxBrowser } from "./types";

const profileSectionSchema = z.object({
  Name: z.string(),
  Path: z.string(),
  IsRelative: z.string().optional(),
});

export interface ParsedProfile {
  name: string;
  path: string;
  isRelative: boolean;
}

export const parseProfilesIni = (content: string): ParsedProfile[] => {
  const sections = Object.values(parseIni(content));
  const profiles: ParsedProfile[] = [];
  for (const section of sections) {
    const result = profileSectionSchema.safeParse(section);
    if (!result.success) continue;
    profiles.push({
      name: result.data.Name,
      path: result.data.Path,
      isRelative: result.data.IsRelative !== "0",
    });
  }
  return profiles;
};

export interface FirefoxPlatform {
  readonly dataDir: string;
  readonly executablePaths: readonly string[];
}

export const firefoxPlatformDarwin: FirefoxPlatform = {
  dataDir: path.join(os.homedir(), FIREFOX_CONFIG.dataDir.darwin),
  executablePaths: [FIREFOX_CONFIG.executable.darwin],
};

export const firefoxPlatformLinux: FirefoxPlatform = {
  dataDir: path.join(os.homedir(), FIREFOX_CONFIG.dataDir.linux),
  executablePaths: FIREFOX_CONFIG.executable.linux,
};

export const firefoxPlatformWin32: FirefoxPlatform = {
  dataDir: path.join(os.homedir(), FIREFOX_CONFIG.dataDir.win32),
  executablePaths: FIREFOX_CONFIG.executable.win32.flatMap((relative) => {
    const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
    const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
    return [path.join(programFiles, relative), path.join(programFilesX86, relative)];
  }),
};

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

export const registerFirefoxSource = (browsers: Browsers, platform: FirefoxPlatform): void => {
  browsers.register(async () => {
    try {
      let executablePath: string | undefined;
      for (const candidate of platform.executablePaths) {
        if (await exists(candidate)) {
          executablePath = candidate;
          break;
        }
      }
      if (!executablePath) return [];

      const iniPath = path.join(platform.dataDir, "profiles.ini");
      const iniContent = await fs.readFile(iniPath, "utf-8");
      const parsedProfiles = parseProfilesIni(iniContent);

      const profiles = await Promise.all(
        parsedProfiles.map(async (parsed): Promise<FirefoxBrowser | undefined> => {
          const profileEntryPath = parsed.isRelative
            ? path.join(platform.dataDir, parsed.path)
            : parsed.path;
          const cookiesPath = path.join(profileEntryPath, "cookies.sqlite");
          if (!(await exists(cookiesPath))) return undefined;

          return makeFirefoxBrowser({
            profileName: path.basename(profileEntryPath),
            profilePath: profileEntryPath,
          });
        }),
      );

      return profiles.filter((profile): profile is FirefoxBrowser => profile !== undefined);
    } catch (cause) {
      throw new ListBrowsersError(String(cause));
    }
  });
};
