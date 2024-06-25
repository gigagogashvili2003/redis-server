import { MapType } from "../types";

export interface IStorageManager {
  snapshot(storage: MapType): Promise<string>;
}
