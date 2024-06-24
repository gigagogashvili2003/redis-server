import { Server, Socket, createServer } from "net";
import { IRedisServer } from "../interfaces";
import { Deserializer } from "../resp/deserializer";
import { Command, DataType } from "../enums";
import { Serializer } from "../resp";
import { AllowedTypes } from "../types";
import { TypeUtils } from "../helpers";

export class RedisServer implements IRedisServer {
  private server?: Server;
  private readonly validCommands = new Set(Object.values(Command));
  private store = new Map<string, any>();

  public constructor(private port: number, private host: string) {
    this.init(port, host);
  }

  private async handleData(data: Buffer) {
    const deserializer = new Deserializer(data.toString());
    const deserielizedArrCommands = deserializer.deserializeArrCommands();
    const command = deserielizedArrCommands[0] as Command;

    const isFirstCommandAcceptable = this.validCommands.has(command);

    if (!isFirstCommandAcceptable) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid command! ${deserielizedArrCommands[0]}`);
    }

    switch (command) {
      case Command.PING: {
        return this.constructResponse(DataType.SIMPLE_STRING, "PONG");
      }

      case Command.ECHO: {
        return this.handleEcho(deserielizedArrCommands);
      }

      case Command.SET: {
        return this.handleSetCommand(deserielizedArrCommands);
      }

      case Command.MSET: {
        return this.handleMultiSet(deserielizedArrCommands.slice(1));
      }

      case Command.GET: {
        return this.handleGetCommand(deserielizedArrCommands);
      }

      case Command.EXISTS: {
        return this.handleExists(deserielizedArrCommands.slice(1));
      }

      case Command.DEL: {
        return this.handleDel(deserielizedArrCommands.slice(1));
      }

      case Command.LPUSH: {
        console.log(this.store);
        return this.handleLPush(deserielizedArrCommands.slice(1));
      }

      case Command.RPUSH: {
        return this.handleLPush(deserielizedArrCommands.slice(1));
      }

      case Command.INCR: {
        return this.handleIncr(deserielizedArrCommands.slice(1));
      }

      default: {
        return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid RESP Command!");
      }
    }
  }

  private handleLPush(deserielizedArrCommands: string[]) {
    if (!deserielizedArrCommands.length || deserielizedArrCommands.length < 2) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const key = deserielizedArrCommands[0];
    const values = deserielizedArrCommands.slice(1);

    const keyExists = this.store.get(key);

    if (keyExists) {
      const isArray = TypeUtils.isArray(keyExists);

      if (!isArray) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not array type's could't be pushed!`);
      }

      keyExists.unshift(...values);
    } else {
      this.store.set(key, []);
      const newKey = this.store.get(key);
      newKey.unshift(...values);
    }

    return this.constructResponse(DataType.INTEGER, values.length);
  }

  private handleRPush(deserielizedArrCommands: string[]) {
    if (!deserielizedArrCommands.length || deserielizedArrCommands.length < 2) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const key = deserielizedArrCommands[0];
    const values = deserielizedArrCommands.slice(1);

    const keyExists = this.store.get(key);

    if (keyExists) {
      const isArray = TypeUtils.isArray(keyExists);

      if (!isArray) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not array type's could't be pushed!`);
      }

      keyExists.push(...values);
    } else {
      this.store.set(key, []);
      const newKey = this.store.get(key);
      newKey.push(...values);
    }

    return this.constructResponse(DataType.INTEGER, values.length);
  }

  private handleIncr(deserielizedArrCommands: string[]) {
    if (!deserielizedArrCommands.length || deserielizedArrCommands.length > 1) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const keyExists = this.store.has(deserielizedArrCommands[0]);

    if (!keyExists) {
      this.store.set(deserielizedArrCommands[0], 0);
    } else {
      const key = this.store.get(deserielizedArrCommands[0]);

      const numKey = Number(key);
      const isKeyValid = TypeUtils.isNumber(numKey);
      if (!isKeyValid) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not integer type's could't be incremented!`);
      }

      this.store.set(deserielizedArrCommands[0], Number(numKey) + 1);
    }

    return this.constructResponse(DataType.INTEGER, 1);
  }

  private handleDecr(deserielizedArrCommands: string[]) {
    if (!deserielizedArrCommands.length || deserielizedArrCommands.length > 1) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const keyExists = this.store.has(deserielizedArrCommands[0]);

    if (!keyExists) {
      this.store.set(deserielizedArrCommands[0], 0);
    } else {
      const key = this.store.get(deserielizedArrCommands[0]);
      const numKey = Number(key);
      const isKeyValid = TypeUtils.isNumber(numKey);
      if (!isKeyValid) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not integer type's could't be decremented!`);
      }

      this.store.set(deserielizedArrCommands[0], Number(numKey) - 1);
    }

    return this.constructResponse(DataType.INTEGER, 1);
  }

  private handleMultiSet(deserielizedArrCommands: string[]) {
    if (!deserielizedArrCommands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for set command! Example: set key value`);
    }

    for (let i = 0; i < deserielizedArrCommands.length; i += 2) {
      const [key, value] = deserielizedArrCommands.slice(i, i + 2);

      if (!key || !value) {
        return this.constructResponse(
          DataType.SIMPLE_ERROR,
          `Invalid syntax for multi set command! Example: set key value`,
        );
      }

      this.store.set(key, value);
    }

    return this.constructResponse(DataType.SIMPLE_STRING, "OK");
  }

  private handleExists(deserielizedArrCommands: string[]) {
    let counter = 0;

    if (!deserielizedArrCommands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid syntax for exists command!");
    }

    for (const key of deserielizedArrCommands) {
      const isKeyPresent = this.store.has(key);

      if (isKeyPresent) {
        counter++;
      }
    }

    return this.constructResponse(DataType.INTEGER, counter);
  }

  private handleDel(deserielizedArrCommands: string[]) {
    let deletedCounter = 0;

    if (!deserielizedArrCommands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid syntax for delete command!");
    }

    for (const key of deserielizedArrCommands) {
      const isKeyPresent = this.store.has(key);

      if (isKeyPresent) {
        this.store.delete(key);
        deletedCounter++;
      }
    }

    return this.constructResponse(DataType.INTEGER, deletedCounter);
  }

  private handleGetCommand(deserielizedArrCommands: string[]) {
    const [key] = deserielizedArrCommands.slice(1);

    return this.constructResponse(DataType.SIMPLE_STRING, this.store.get(key) || "Not found!");
  }

  private handleSetCommand(deserielizedArrCommands: string[]) {
    if (deserielizedArrCommands.length < 3) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for set command! Example: set key value`);
    }

    const [key, value] = deserielizedArrCommands.slice(1);
    this.store.set(key, value);

    return this.constructResponse(DataType.SIMPLE_STRING, "OK");
  }

  private handleEcho(deserielizedArrCommands: string[]) {
    if (deserielizedArrCommands.length !== 2) {
      return this.constructResponse(
        DataType.SIMPLE_ERROR,
        `Invalid syntax for echo command! Example: echo "something"`,
      );
    }

    return this.constructResponse(DataType.SIMPLE_STRING, deserielizedArrCommands[1]);
  }

  private constructResponse(type: DataType, output: AllowedTypes) {
    const serializedResponse = new Serializer().serialize(type, output);
    return serializedResponse;
  }

  private init(port: number, host: string) {
    this.server = createServer((socket: Socket) => {
      socket.on("data", (data: Buffer) => this.handleData(data).then((data) => socket.write(data)));

      socket.on("error", (error: Error) => {
        console.log(error);
      });
    });

    this.server.listen(port, host, () => {
      console.log(`Server is listening on port:${port}, at ${host}`);
    });
  }
}
