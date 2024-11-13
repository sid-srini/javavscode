/*
  Copyright (c) 2024, Oracle and/or its affiliates.

  Licensed under the Apache License, Version 2.0 (the "License");
  you may not use this file except in compliance with the License.
  You may obtain a copy of the License at

     https://www.apache.org/licenses/LICENSE-2.0

  Unless required by applicable law or agreed to in writing, software
  distributed under the License is distributed on an "AS IS" BASIS,
  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
  See the License for the specific language governing permissions and
  limitations under the License.
*/
import { Uri } from "vscode";
import { CacheService } from "../types";
import { exists, getHashCode, mkdir, readFile, writeFile } from "../utils";
import { LOGGER } from "../../logger";

export class CacheServiceImpl implements CacheService {

    private cacheMap = new Map<string, string>();
    constructor(private cachePath: Uri) { }

    public get = async (key: string): Promise<string | undefined> => {
        try {
            const filePath = Uri.joinPath(this.cachePath, `${key}.txt`);
            const isFileExists = await exists(filePath);
            if (!isFileExists) {
                throw new Error("key doesn't exists");
            }
            if (this.cacheMap.has(key)) {
                return this.cacheMap.get(key);
            }
            const value = await readFile(filePath);
            return value;
        } catch (err) {
            LOGGER.error(`Error while retrieving ${key} from cache: ${(err as Error).message}`);
            return undefined;
        }
    }

    public put = async (key: string, value: string): Promise<boolean> => {
        try {
            const filePath = Uri.joinPath(this.cachePath, `${key}.txt`);
            const flag = await this.isCacheDirExists();
            if (!flag) {
                await mkdir(this.cachePath);
            }
            const hash = getHashCode(value);
            await writeFile(filePath, hash);
            this.cacheMap.set(key, hash);

            return true;
        } catch (err) {
            LOGGER.error(`Error while storing ${key} in cache: ${(err as Error).message}`);
            return false;
        }
    }

    public getCachePath = (): Uri => this.cachePath;

    public isCacheDirExists = async (): Promise<boolean> => await exists(this.cachePath);
}