import fs from "node:fs";
import path from "node:path";

export const createSymlinkSafe = (target: string, linkPath: string): boolean => {
  try {
    const linkParent = path.dirname(linkPath);
    fs.mkdirSync(linkParent, { recursive: true });

    const resolvedTarget = fs.realpathSync(target);
    const resolvedLinkParent = fs.realpathSync(linkParent);
    const resolvedLinkPath = path.join(resolvedLinkParent, path.basename(linkPath));

    if (resolvedLinkPath === resolvedTarget) return true;

    if (fs.existsSync(linkPath)) {
      const linkStat = fs.lstatSync(linkPath);
      if (linkStat.isSymbolicLink()) {
        const existingTarget = fs.readlinkSync(linkPath);
        const resolvedExisting = path.resolve(path.dirname(linkPath), existingTarget);
        if (resolvedExisting === resolvedTarget) return true;
        fs.unlinkSync(linkPath);
      } else {
        fs.rmSync(linkPath, { recursive: true });
      }
    }

    const relativePath = path.relative(resolvedLinkParent, resolvedTarget);
    fs.symlinkSync(relativePath, linkPath);
    return true;
  } catch {
    return false;
  }
};
