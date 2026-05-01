import { describe, expect, it } from "vite-plus/test";
import { parseProfilesIni } from "../../src/cookies/firefox";

describe("parseProfilesIni", () => {
  it("returns empty array for empty content", () => {
    expect(parseProfilesIni("")).toEqual([]);
  });

  it("ignores sections without Name+Path", () => {
    const ini = `
[General]
StartWithLastProfile=1
Version=2

[Install4F96D1932A9F858E]
Default=Profiles/abc.default
Locked=1
`;
    expect(parseProfilesIni(ini)).toEqual([]);
  });

  it("parses a single relative profile", () => {
    const ini = `
[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/abc123.default-release
Default=1
`;
    expect(parseProfilesIni(ini)).toEqual([
      {
        name: "default-release",
        path: "Profiles/abc123.default-release",
        isRelative: true,
      },
    ]);
  });

  it("parses a single absolute profile (IsRelative=0)", () => {
    const ini = `
[Profile0]
Name=custom
IsRelative=0
Path=/opt/custom/profile
`;
    expect(parseProfilesIni(ini)).toEqual([
      {
        name: "custom",
        path: "/opt/custom/profile",
        isRelative: false,
      },
    ]);
  });

  it("treats missing IsRelative as relative", () => {
    const ini = `
[Profile0]
Name=alpha
Path=Profiles/alpha
`;
    expect(parseProfilesIni(ini)).toEqual([
      {
        name: "alpha",
        path: "Profiles/alpha",
        isRelative: true,
      },
    ]);
  });

  it("parses multiple profiles in a single ini", () => {
    const ini = `
[General]
StartWithLastProfile=1

[Profile0]
Name=default-release
IsRelative=1
Path=Profiles/abc.default-release

[Profile1]
Name=dev
IsRelative=1
Path=Profiles/dev.profile

[Profile2]
Name=external
IsRelative=0
Path=/var/firefox/external
`;
    const profiles = parseProfilesIni(ini);
    expect(profiles).toHaveLength(3);
    expect(profiles.map((profile) => profile.name)).toEqual(["default-release", "dev", "external"]);
    expect(profiles[2].isRelative).toBe(false);
  });
});
