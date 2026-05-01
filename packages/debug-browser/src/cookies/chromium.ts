import { execFile } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import { CHROMIUM_CONFIGS, type ChromiumConfig } from "./browser-config";
import { CONCURRENCY_PROFILE_SCAN } from "./constants";
import { ListBrowsersError } from "./errors";
import { Browsers } from "./browser-detector";
import {
  chromiumBrowserOrderBy,
  makeChromiumBrowser,
  type ChromiumBrowser,
  type ChromiumBrowserKey,
} from "./types";

const execFileAsync = promisify(execFile);

const localStateSchema = z.object({
  profile: z
    .object({
      last_used: z.string().optional(),
    })
    .optional(),
});

const preferencesSchema = z.object({
  intl: z
    .object({
      selected_languages: z.string().optional(),
      accept_languages: z.string().optional(),
    })
    .optional(),
});

export interface ChromiumPlatform {
  executableCandidates(config: ChromiumConfig): readonly string[];
  userDataDir(config: ChromiumConfig): string;
}

export const chromiumPlatformDarwin: ChromiumPlatform = {
  executableCandidates: (config) => [config.executable.darwin],
  userDataDir: (config) =>
    path.join(os.homedir(), "Library", "Application Support", config.userData.darwin),
};

export const chromiumPlatformLinux: ChromiumPlatform = {
  executableCandidates: (config) => config.executable.linux,
  userDataDir: (config) =>
    path.join(
      process.env["XDG_CONFIG_HOME"] ?? path.join(os.homedir(), ".config"),
      config.userData.linux,
    ),
};

const queryRegistry = async (registryKey: string): Promise<string | undefined> => {
  const regPath = `HKLM\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths\\${registryKey}`;
  try {
    const { stdout } = await execFileAsync("reg", ["query", regPath, "/ve"]);
    const match = stdout.match(/REG_SZ\s+(.+)/);
    return match?.[1]?.trim();
  } catch {
    return undefined;
  }
};

export const createChromiumPlatformWin32 = async (): Promise<ChromiumPlatform> => {
  const registryPaths = new Map<string, string>();
  for (const config of CHROMIUM_CONFIGS) {
    const registryExePath = await queryRegistry(config.registryKey);
    if (registryExePath) registryPaths.set(config.key, registryExePath);
  }

  const programFiles = process.env["ProgramFiles"] ?? "C:\\Program Files";
  const programFilesX86 = process.env["ProgramFiles(x86)"] ?? "C:\\Program Files (x86)";
  const localAppData =
    process.env["LOCALAPPDATA"] ?? path.join(os.homedir(), "AppData", "Local");

  return {
    executableCandidates: (config) => {
      const candidates: string[] = [];
      const regPath = registryPaths.get(config.key);
      if (regPath) candidates.push(regPath);
      for (const relative of config.executable.win32) {
        candidates.push(
          path.join(programFiles, relative),
          path.join(programFilesX86, relative),
          path.join(localAppData, relative),
        );
      }
      return candidates;
    },
    userDataDir: (config) => path.join(localAppData, config.userData.win32),
  };
};

const exists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

const readJsonSafe = async <T>(
  filePath: string,
  schema: z.ZodType<T>,
): Promise<T | undefined> => {
  try {
    const content = await fs.readFile(filePath, "utf-8");
    return schema.parse(JSON.parse(content));
  } catch {
    return undefined;
  }
};

const getLastUsedProfile = async (userDataDir: string): Promise<string | undefined> => {
  const localState = await readJsonSafe(path.join(userDataDir, "Local State"), localStateSchema);
  return localState?.profile?.last_used;
};

const loadProfileLocale = async (profilePath: string): Promise<string | undefined> => {
  const preferences = await readJsonSafe(
    path.join(profilePath, "Preferences"),
    preferencesSchema,
  );
  if (!preferences) return undefined;
  const languages = preferences.intl?.selected_languages ?? preferences.intl?.accept_languages;
  if (!languages) return undefined;
  return languages
    .split(",")
    .map((language) => language.trim())
    .find((language) => language.length > 0);
};

const mapWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;

  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const currentIndex = nextIndex++;
      if (currentIndex >= items.length) return;
      results[currentIndex] = await worker(items[currentIndex]);
    }
  });

  await Promise.all(runners);
  return results;
};

const detectProfiles = async (
  key: ChromiumBrowserKey,
  executablePath: string,
  userDataDir: string,
): Promise<ChromiumBrowser[]> => {
  if (!(await exists(userDataDir))) return [];

  const lastUsedProfileName = await getLastUsedProfile(userDataDir);
  let entries: string[];
  try {
    entries = await fs.readdir(userDataDir);
  } catch {
    return [];
  }

  const profiles = await mapWithConcurrency(
    entries,
    CONCURRENCY_PROFILE_SCAN,
    async (entry): Promise<ChromiumBrowser | undefined> => {
      const profileEntryPath = path.join(userDataDir, entry);
      if (!(await exists(path.join(profileEntryPath, "Preferences")))) return undefined;

      const locale = await loadProfileLocale(profileEntryPath);
      return makeChromiumBrowser({
        key,
        profileName: entry,
        profilePath: profileEntryPath,
        executablePath,
        ...(locale ? { locale } : {}),
      });
    },
  );

  const filtered = profiles.filter((profile): profile is ChromiumBrowser => profile !== undefined);
  filtered.sort(chromiumBrowserOrderBy(lastUsedProfileName));
  return filtered;
};

export const registerChromiumSource = (browsers: Browsers, platform: ChromiumPlatform): void => {
  browsers.register(async () => {
    try {
      const results = await Promise.all(
        CHROMIUM_CONFIGS.map(async (config) => {
          let executablePath: string | undefined;
          for (const candidate of platform.executableCandidates(config)) {
            if (await exists(candidate)) {
              executablePath = candidate;
              break;
            }
          }
          if (!executablePath) return [];
          return detectProfiles(config.key, executablePath, platform.userDataDir(config));
        }),
      );
      return results.flat();
    } catch (cause) {
      throw new ListBrowsersError(String(cause));
    }
  });
};
