import { DataType } from "../enums";
import { IErrror } from "../interfaces/error.interface";
import { RedisServer } from "../server";

export class InvalidSyntaxError implements IErrror {
  public constructor(private redisServer: RedisServer) {}

  public constructErrorResponse(): string {
    return this.redisServer.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for that command!`);
  }
}
