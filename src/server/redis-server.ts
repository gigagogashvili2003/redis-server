import { Server, Socket, createServer } from "net";
import { IRedisServer } from "../interfaces";
import { Deserializer } from "../resp/deserializer";
import { Command, DataType } from "../enums";
import { Serializer } from "../resp";
import { AllowedTypes } from "../types";
import { TypeUtils } from "../helpers";
import { MemoryManager } from "../memory-manager";

export class RedisServer implements IRedisServer {
  private server?: Server;
  private readonly validCommands = new Set(Object.values(Command));
  private store = new Map<string, { value: any; counter: number }>();
  private memoryManager!: MemoryManager;

  public constructor(private port: number, private host: string) {
    this.init(port, host);
    this.memoryManager = new MemoryManager();
    setInterval(() => {
      this.memoryManager.manage(this.store, process.memoryUsage());
    }, 30000);
  }

  private async handleData(data: Buffer) {
    const deserializer = new Deserializer(data.toString());
    const commands = deserializer.deserializeArrCommands();
    const command = commands[0] as Command;

    const isFirstCommandAcceptable = this.validCommands.has(command);

    if (!isFirstCommandAcceptable) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid command! ${commands[0]}`);
    }

    switch (command) {
      case Command.PING: {
        return this.constructResponse(DataType.SIMPLE_STRING, "PONG");
      }

      case Command.ECHO: {
        return this.handleEcho(commands.slice(1));
      }

      case Command.SET: {
        return this.handleSetCommand(commands.slice(1));
      }

      case Command.MSET: {
        return this.handleMultiSet(commands.slice(1));
      }

      case Command.GET: {
        return this.handleGetCommand(commands.slice(1));
      }

      case Command.EXISTS: {
        return this.handleExists(commands.slice(1));
      }

      case Command.DEL: {
        return this.handleDel(commands.slice(1));
      }

      case Command.LPUSH: {
        console.log(this.store);
        return this.handleLPush(commands.slice(1));
      }

      case Command.RPUSH: {
        return this.handleRPush(commands.slice(1));
      }

      case Command.LRANGE: {
        return this.handleLRange(commands.slice(1));
      }

      case Command.INCR: {
        return this.handleIncr(commands.slice(1));
      }

      case Command.DECR: {
        return this.handleDecr(commands.slice(1));
      }

      default: {
        return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid RESP Command!");
      }
    }
  }

  private handleLRange(commands: string[]) {
    if (!commands.length || commands.length > 3) {
      return this.constructResponse(
        DataType.SIMPLE_ERROR,
        `Invalid syntax for lrange command! Example: lrange key start end`,
      );
    }

    const [key, start, stop] = commands;

    const numStart = Number(start);
    const numStop = Number(stop);

    const isValidStart = TypeUtils.isNumber(numStart);
    const isValidStop = TypeUtils.isNumber(numStop);

    if (!isValidStart || !isValidStop) {
      return this.constructResponse(
        DataType.SIMPLE_ERROR,
        `Invalid syntax for lrange command! Example: lrange key start end`,
      );
    }

    const keyExists = this.store.get(key);

    if (!keyExists) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Not found key!`);
    }

    if (numStart > numStop) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid range!`);
    }
    const elementsToReturn = [];

    const isStartPositive = numStart >= 0;
    if (isStartPositive) {
      for (let i = numStart; i <= numStop; i++) {
        elementsToReturn.push(keyExists.value[i]);
      }
    } else {
      const startIndex = keyExists.value.length - numStart;
      const isStopPositive = numStop >= 0;

      if (isStopPositive) {
        const stopIndex = keyExists.value.length - numStop;
        for (let i = startIndex; i >= stopIndex; i--) {
          elementsToReturn.push(keyExists.value[i]);
        }
      } else {
        const stopIndex = keyExists.value.length - numStop;

        for (let i = startIndex; i >= stopIndex; i++) {
          elementsToReturn.push(keyExists.value[i]);
        }
      }

      if (startIndex < 0) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid range!`);
      }
    }
    keyExists.counter++;

    return this.constructResponse(DataType.SIMPLE_STRING, elementsToReturn.toString());
  }

  private handleLPush(commands: string[]) {
    if (!commands.length || commands.length < 2) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const key = commands[0];
    const values = commands.slice(1);

    const keyExists = this.store.get(key);

    if (keyExists) {
      const isArray = TypeUtils.isArray(keyExists);

      if (!isArray) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not array type's could't be pushed!`);
      }

      keyExists.value.unshift(...values);
      keyExists.counter++;
    } else {
      this.store.set(key, { value: [], counter: 1 });
      const newKey = this.store.get(key);
      newKey?.value.unshift(...values);
    }

    return this.constructResponse(DataType.INTEGER, values.length);
  }

  private handleRPush(commands: string[]) {
    if (!commands.length || commands.length < 2) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const key = commands[0];
    const values = commands.slice(1);

    const keyExists = this.store.get(key);

    if (keyExists) {
      const isArray = TypeUtils.isArray(keyExists);

      if (!isArray) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not array type's could't be pushed!`);
      }

      keyExists.value.push(...values);
      keyExists.counter++;
    } else {
      this.store.set(key, { value: [], counter: 1 });
      const newKey = this.store.get(key);
      newKey?.value.push(...values);
    }

    return this.constructResponse(DataType.INTEGER, values.length);
  }

  private handleIncr(commands: string[]) {
    if (!commands.length || commands.length > 1) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const keyExists = this.store.has(commands[0]);

    if (!keyExists) {
      this.store.set(commands[0], { value: 0, counter: 1 });
    } else {
      const key = this.store.get(commands[0]);

      const numKey = Number(key?.value);

      const isKeyValid = TypeUtils.isNumber(numKey);
      if (!isKeyValid) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not integer type's could't be incremented!`);
      }

      this.store.set(commands[0], { value: Number(numKey) + 1, counter: key?.counter! + 1 });
    }

    return this.constructResponse(DataType.INTEGER, 1);
  }

  private handleDecr(commands: string[]) {
    if (!commands.length || commands.length > 1) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for incr command! Example: set key value`);
    }

    const keyExists = this.store.has(commands[0]);

    if (!keyExists) {
      this.store.set(commands[0], { value: 0, counter: 1 });
    } else {
      const key = this.store.get(commands[0]);

      const numKey = Number(key?.value);

      const isKeyValid = TypeUtils.isNumber(numKey);
      if (!isKeyValid) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not integer type's could't be incremented!`);
      }

      this.store.set(commands[0], { value: Number(numKey) - 1, counter: key?.counter! + 1 });
    }

    return this.constructResponse(DataType.INTEGER, 1);
  }

  private handleMultiSet(commands: string[]) {
    if (!commands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for set command! Example: set key value`);
    }

    for (let i = 0; i < commands.length; i += 2) {
      const [key, value] = commands.slice(i, i + 2);

      if (!key || !value) {
        return this.constructResponse(
          DataType.SIMPLE_ERROR,
          `Invalid syntax for multi set command! Example: set key value`,
        );
      }

      this.store.set(key, { value, counter: 1 });
    }

    return this.constructResponse(DataType.SIMPLE_STRING, "OK");
  }

  private handleExists(commands: string[]) {
    let counter = 0;

    if (!commands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid syntax for exists command!");
    }

    for (const key of commands) {
      const isKeyPresent = this.store.has(key);

      if (isKeyPresent) {
        counter++;
      }
    }

    return this.constructResponse(DataType.INTEGER, counter);
  }

  private handleDel(commands: string[]) {
    let deletedCounter = 0;

    if (!commands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid syntax for delete command!");
    }

    for (const key of commands) {
      const isKeyPresent = this.store.has(key);

      if (isKeyPresent) {
        this.store.delete(key);
        deletedCounter++;
      }
    }

    return this.constructResponse(DataType.INTEGER, deletedCounter);
  }

  private handleGetCommand(commands: string[]) {
    if (!commands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid syntax for get command!");
    }

    const [key] = commands;

    const isKeyPresent = this.store.get(key);

    if (isKeyPresent) {
      this.store.set(key, { ...isKeyPresent, counter: isKeyPresent.counter + 1 });
    }

    return this.constructResponse(DataType.SIMPLE_STRING, this.store.get(key)?.value || "Not found!");
  }

  private handleSetCommand(commands: string[]) {
    if (commands.length < 2) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid syntax for set command! Example: set key value`);
    }

    const [key, value] = commands;
    const isNumberValue = TypeUtils.isNumber(Number(value));

    if (isNumberValue) {
      this.store.set(key, { value: Number(value), counter: 1 });
    } else {
      this.store.set(key, { value, counter: 1 });
    }

    return this.constructResponse(DataType.SIMPLE_STRING, "OK");
  }

  private handleEcho(commands: string[]) {
    if (!commands.length) {
      return this.constructResponse(
        DataType.SIMPLE_ERROR,
        `Invalid syntax for echo command! Example: echo "something"`,
      );
    }

    return this.constructResponse(DataType.SIMPLE_STRING, commands[1]);
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
