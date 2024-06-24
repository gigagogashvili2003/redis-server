export class TypeUtils {
  static isNumber(value: any): boolean {
    return typeof value === "number" && !isNaN(value);
  }
  static isArray(value: any): boolean {
    return Array.isArray(value);
  }
}
