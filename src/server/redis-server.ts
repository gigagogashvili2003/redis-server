import { Server, Socket, createServer } from "net";
import { IRedisServer } from "../interfaces";
import { Deserializer } from "../resp/deserializer";
import { Command, DataType, ErrorType, OperationType, Option } from "../enums";
import { Serializer } from "../resp";
import { AllowedType, MapType, ValueType } from "../types";
import { TypeUtils } from "../helpers";
import { MemoryManager } from "../memory-manager";
import { StorageManager } from "../storage";
import { InvalidSyntaxError } from "../errors-wrapper";

export class RedisServer implements IRedisServer {
  private server?: Server;

  private readonly ValidCommands = new Set(Object.values(Command));
  private readonly ValidOptions = new Set(Object.values(Option));

  private store: MapType = new Map<string, ValueType>();

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

    if (!commands.length) {
      return this.constructResponse(DataType.SIMPLE_ERROR, "Command not found!");
    }

    const command = commands[0] as Command;

    const isFirstCommandAcceptable: boolean = this.ValidCommands.has(command);

    if (!isFirstCommandAcceptable) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `${ErrorType.WRONG_COMAND} Command ${commands[0]} isn't acceptable!`);
    }

    return this.handleCommand(command, commands.slice(1));
  }

  private handleCommand(command: Command, commands: string[]) {
    switch (command) {
      case Command.PING: {
        return this.constructResponse(DataType.SIMPLE_STRING, "PONG");
      }

      case Command.ECHO: {
        return this.handleEcho(commands);
      }

      case Command.SET: {
        return this.handleSetCommand(commands);
      }

      case Command.MSET: {
        return this.handleMultiSet(commands);
      }

      case Command.GET: {
        return this.handleGetCommand(commands);
      }

      case Command.EXISTS: {
        return this.handleExists(commands);
      }

      case Command.DEL: {
        return this.handleDel(commands);
      }

      case Command.LPUSH: {
        return this.handleLPush(commands);
      }

      case Command.RPUSH: {
        return this.handleRPush(commands);
      }

      case Command.LRANGE: {
        return this.handleLRange(commands);
      }

      case Command.INCR: {
        return this.handleIncrDecr(OperationType.INCREMENT, commands);
      }

      case Command.DECR: {
        return this.handleIncrDecr(OperationType.DECREMENT, commands);
      }

      case Command.SAVE: {
        return this.handleSave();
      }

      default: {
        return this.constructResponse(DataType.SIMPLE_ERROR, "Invalid RESP Command!");
      }
    }
  }

  private async handleSave() {
    try {
      const storageManager = new StorageManager();
      const makeSnapshot = await storageManager.snapshot(this.store);

      return this.constructResponse(DataType.SIMPLE_STRING, makeSnapshot);
    } catch (err) {
      return this.constructResponse(DataType.SIMPLE_ERROR, "Somethign went wrong");
    }
  }

  private handleLRange(commands: string[]) {
    if (!commands.length || commands.length > 3) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    const [key, start, stop] = commands;

    const numStart = Number(start);
    const numStop = Number(stop);

    const isValidStart = TypeUtils.isNumber(numStart);
    const isValidStop = TypeUtils.isNumber(numStop);

    if (!isValidStart || !isValidStop) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    const keyExists = this.store.get(key);

    if (!keyExists) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Not found key!`);
    }

    const value = keyExists.value as Array<AllowedType>;

    if (numStart > numStop) {
      return this.constructResponse(DataType.SIMPLE_ERROR, `Invalid range!`);
    }
    const elementsToReturn = [];

    const isStartPositive = numStart >= 0;
    if (isStartPositive) {
      for (let i = numStart; i <= numStop; i++) {
        elementsToReturn.push(value[i]);
      }
    } else {
      const startIndex = value.length - numStart;
      const isStopPositive = numStop >= 0;

      if (isStopPositive) {
        const stopIndex = value.length - numStop;
        for (let i = startIndex; i >= stopIndex; i--) {
          elementsToReturn.push(value[i]);
        }
      } else {
        const stopIndex = value.length - numStop;

        for (let i = startIndex; i >= stopIndex; i++) {
          elementsToReturn.push(value[i]);
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
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    const key = commands[0];
    const values = commands.slice(1);

    const keyExists = this.store.get(key);

    if (keyExists) {
      const isArray = TypeUtils.isArray(keyExists);

      if (!isArray) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not array type's could't be pushed!`);
      }

      const value = keyExists.value as Array<AllowedType>;

      value.unshift(...values);

      keyExists.counter++;
    } else {
      this.store.set(key, { value: [], counter: 1 });

      const newKey = this.store.get(key) as ValueType;

      const value = newKey.value as Array<AllowedType>;

      value.unshift(...values);
    }

    return this.constructResponse(DataType.INTEGER, values.length);
  }

  private handleRPush(commands: string[]) {
    if (!commands.length || commands.length < 2) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    const key = commands[0];
    const values = commands.slice(1);

    const keyExists = this.store.get(key);

    if (keyExists) {
      const isArray = TypeUtils.isArray(keyExists);

      if (!isArray) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not array type's could't be pushed!`);
      }

      const value = keyExists.value as Array<AllowedType>;

      value.push(...values);
      keyExists.counter++;
    } else {
      this.store.set(key, { value: [], counter: 1 });

      const newKey = this.store.get(key) as ValueType;
      const value = newKey.value as Array<AllowedType>;

      value.push(...values);
    }

    return this.constructResponse(DataType.INTEGER, values.length);
  }

  private handleIncrDecr(type: OperationType, commands: string[]) {
    if (!commands.length || commands.length > 1) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    const key = commands[0];
    const keyExists = this.store.get(key);

    if (!keyExists) {
      this.store.set(key, { value: 0, counter: 1 });
    } else {
      const numKey = Number(keyExists.value);

      const isValueTypeOfNumber = TypeUtils.isNumber(numKey);

      if (!isValueTypeOfNumber) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `Not integer type's could't be incremented!`);
      }

      const newValue = type === "increment" ? numKey + 1 : numKey - 1;

      this.store.set(key, { value: newValue, counter: keyExists.counter - 1 });
    }

    return this.constructResponse(DataType.INTEGER, 1);
  }

  private handleMultiSet(commands: string[]) {
    if (!commands.length) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    for (let i = 0; i < commands.length; i += 2) {
      const [key, value] = commands.slice(i, i + 2);

      if (!key || !value) {
        return new InvalidSyntaxError(this).constructErrorResponse();
      }

      this.store.set(key, { value, counter: 1 });
    }

    return this.constructResponse(DataType.SIMPLE_STRING, "OK");
  }

  private handleExists(commands: string[]) {
    let counter = 0;

    if (!commands.length) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    for (const key of commands) {
      const keyExists = this.store.get(key);

      if (keyExists) {
        this.store.set(key, { ...keyExists, counter: keyExists.counter + 1 });
        counter++;
      }
    }

    return this.constructResponse(DataType.INTEGER, counter);
  }

  private handleDel(commands: string[]) {
    let counter = 0;

    if (!commands.length) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    for (const key of commands) {
      const keyExists = this.store.has(key);

      if (keyExists) {
        this.store.delete(key);
        counter++;
      }
    }

    return this.constructResponse(DataType.INTEGER, counter);
  }

  private handleGetCommand(commands: string[]) {
    if (!commands.length) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    const key = commands[0];
    const keyExists = this.store.get(key);

    if (keyExists) {
      this.store.set(key, { ...keyExists, counter: keyExists.counter + 1 });
    }

    if (keyExists?.options?.ttl) {
      const ttl = keyExists.options.ttl;
      const hasTTLElapsed = ttl.getTime() < new Date().getTime();

      if (hasTTLElapsed) {
        this.store.delete(key);
      }
    }

    return this.constructResponse(DataType.SIMPLE_STRING, keyExists?.value ?? "Not found!");
  }

  private handleSetCommand(commands: string[]) {
    if (commands.length < 2) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    const option = commands[2] as Option;
    const optionValue = commands[3];

    if (option) {
      if (!optionValue) {
        return new InvalidSyntaxError(this).constructErrorResponse();
      }

      const isOptionValid = this.ValidOptions.has(option);

      if (!isOptionValid) {
        return this.constructResponse(DataType.SIMPLE_ERROR, `${ErrorType.WRONG_OPTION} Option ${commands[2]} isn't acceptable!`);
      }

      const isValueValid = TypeUtils.isNumber(Number(optionValue));

      if (!isValueValid) {
        return new InvalidSyntaxError(this).constructErrorResponse();
      }
    }

    const [key, value] = commands;
    const numValue = Number(value);
    const boolValue = Boolean(value);
    const isNumberValue = TypeUtils.isNumber(numValue);
    const isBooleanValue = TypeUtils.isBoolean(numValue);

    const handledOption = this.handleOption(option, Number(optionValue));

    if (isNumberValue) {
      this.store.set(key, { value: numValue, counter: 1, options: { ...handledOption } });
    } else if (isBooleanValue) {
      this.store.set(key, { value: boolValue, counter: 1, options: { ...handledOption } });
    } else {
      this.store.set(key, { value, counter: 1, options: { ...handledOption } });
    }

    return this.constructResponse(DataType.SIMPLE_STRING, "OK");
  }

  private handleOption(option: Option, optionValue: number) {
    switch (option) {
      case Option.EX: {
        return { ttl: new Date(new Date().getTime() + optionValue * 1000) };
      }

      case Option.PX: {
        return { ttl: new Date(new Date().getTime() + optionValue) };
      }
    }
  }

  private handleEcho(commands: string[]) {
    if (!commands.length) {
      return new InvalidSyntaxError(this).constructErrorResponse();
    }

    return this.constructResponse(DataType.SIMPLE_STRING, commands[1]);
  }

  public constructResponse(type: DataType, output: AllowedType) {
    const serializedResponse = new Serializer().serialize(type, output);
    return serializedResponse;
  }

  private init(port: number, host: string) {
    this.server = createServer((socket: Socket) => {
      socket.on("data", (data: Buffer) => this.handleData(data).then((data) => socket.write(data as string)));

      socket.on("close", () => {
        console.log("Socket closed!");
      });

      socket.on("error", (error: Error) => {
        console.log(error);
      });
    });

    this.server.listen(port, host, () => {
      console.log(`Server is listening on port:${port}, at ${host}`);
    });

    this.server?.on("error", (e) => {
      console.error("Address in use, retrying...");
      setTimeout(() => {
        this.server?.emit("close");
        this.server?.listen(port, host);
      }, 1000);
    });

    this.server.on("close", () => {
      this.server?.close();
      console.log("Server closed!");
    });
  }
}
