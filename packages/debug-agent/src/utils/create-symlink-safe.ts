import fs from "node:fs";
import path from "node:path";

export const createSymlinkSafe = (target: string, linkPath: string): boolean => {
  try {
    const linkDirectory = path.dirname(linkPath);
    fs.mkdirSync(linkDirectory, { recursive: true });

    if (fs.existsSync(linkPath)) {
      const linkStat = fs.lstatSync(linkPath);
      if (linkStat.isSymbolicLink()) {
        const existingTarget = fs.readlinkSync(linkPath);
        const resolvedExisting = path.resolve(path.dirname(linkPath), existingTarget);
        if (resolvedExisting === path.resolve(target)) return true;
        fs.unlinkSync(linkPath);
      } else {
        fs.rmSync(linkPath, { recursive: true });
      }
    }

    const relativePath = path.relative(path.dirname(linkPath), target);
    fs.symlinkSync(relativePath, linkPath);
    return true;
  } catch {
    return false;
  }
};
