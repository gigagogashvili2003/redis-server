import { DigitalStorageType } from "../enums";
import { ValueType } from "../types";

export interface IMemoryManager {
  manage(store: Map<string, ValueType>, memoryUsage: NodeJS.MemoryUsage, type: DigitalStorageType, treshold: number): void;
}
