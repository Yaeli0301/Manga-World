import { describe, it, expect } from "@jest/globals";
import AdmZip from "adm-zip";
import { parseZipStructure } from "../src/services/bulkUpload.service.js";

describe("bulk upload zip parsing", () => {
  it("detects chapters from folders", () => {
    const zip = new AdmZip();
    zip.addFile("ch1/001.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    zip.addFile("ch1/002.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    zip.addFile("ch2/a.png", Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const buf = zip.toBuffer();
    const { chapters } = parseZipStructure(buf);
    expect(chapters.length).toBeGreaterThanOrEqual(1);
  });
});
