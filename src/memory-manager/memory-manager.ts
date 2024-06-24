import { DigitalStorageType } from "../enums";

export class MemoryManager {
  public constructor() {}

  public manage(
    store: Map<string, { value: any; counter: number }>,
    memoryUsage: NodeJS.MemoryUsage,
    type: DigitalStorageType = DigitalStorageType.MB,
    treshold: number = 1,
  ) {
    const curMemoryInMb = this.convertMemoryUsage(memoryUsage, type);
    let remainingMemory = curMemoryInMb.heapTotal - curMemoryInMb.heapUsed;

    console.log("Current Memory Usage:", curMemoryInMb);
    console.log("Remaining Memory:", remainingMemory);
    console.log("Store before management:", store);

    const sortedStore = Array.from(store.entries()).sort((a, b) => b[1].counter - a[1].counter);

    while (remainingMemory < treshold && sortedStore.length > 0) {
      const poppredElement: any = sortedStore.pop();

      store.delete(poppredElement?.at(0));

      const updatedMemoryUsage = process.memoryUsage();
      const updatedCurMemoryInMb = this.convertMemoryUsage(updatedMemoryUsage, type);
      remainingMemory = updatedCurMemoryInMb.heapTotal - updatedCurMemoryInMb.heapUsed;

      console.log(`Deleted key: ${poppredElement?.at(0)}, Remaining Memory: ${remainingMemory}`);
    }
  }

  public convertMemoryUsage(memoryUsage: NodeJS.MemoryUsage, type: DigitalStorageType): NodeJS.MemoryUsage {
    const divisor = {
      [DigitalStorageType.KB]: 1024,
      [DigitalStorageType.MB]: 1024 * 1024,
      [DigitalStorageType.GB]: 1024 * 1024 * 1024,
      [DigitalStorageType.TB]: 1024 * 1024 * 1024 * 1024,
    }[type];

    const convertedMemoryUsage: any = {};

    Object.entries(memoryUsage).forEach(([key, value]) => {
      convertedMemoryUsage[key] = Number((value / divisor).toFixed(2));
    });

    return convertedMemoryUsage as NodeJS.MemoryUsage;
  }
}
