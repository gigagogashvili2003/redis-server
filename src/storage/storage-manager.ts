import fs from "fs/promises";
import path from "path";

export class StorageManager {
  public constructor() {}

  public async snapshot(storage: Map<string, { value: any; counter: number }>) {
    try {
      await fs.mkdir(path.resolve(__dirname, "snapshots"), { recursive: true });

      const storageInObject: any = {};

      for (const [key, value] of storage.entries()) {
        storageInObject[key] = value.value;
      }

      const snapshot = JSON.stringify(storageInObject, null, 4);

      await fs.writeFile(path.resolve(__dirname, "snapshots", `snapshot-${Date.now()}.rdb`), snapshot);

      return "OK";
    } catch (err) {
      return "Cann's make snapshot!";
    }
  }
}
