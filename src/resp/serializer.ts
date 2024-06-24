import { CRLF } from "../constants";
import { DataType } from "../enums";

export class Serializer {
  public constructor() {}

  public serialize(type: DataType, input: string) {
    switch (type) {
      case DataType.SIMPLE_STRING: {
        return `${type}${input}${CRLF}`;
      }
      case DataType.SIMPLE_ERROR: {
        return `${type}${input}${CRLF}`;
      }
      default: {
        return `${type}${input}${CRLF}`;
      }
    }
  }

  public serializeSimpleString() {}
}
