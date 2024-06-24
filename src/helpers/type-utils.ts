export class TypeUtils {
  static isNumber(value: any): boolean {
    return typeof value === "number" && !isNaN(value);
  }
}
