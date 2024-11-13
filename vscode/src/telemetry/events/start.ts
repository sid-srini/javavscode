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
import { globalState } from "../../globalState";
import { LOGGER } from "../../logger";
import { getEnvironmentInfo } from "../impl/enviromentDetails";
import { CacheService } from "../types";
import { getHashCode } from "../utils";
import { BaseEvent } from "./baseEvent";

interface ExtensionInfo {
    id: string;
    name: string;
    version: string;
}

interface VscodeInfo {
    version: string;
    hostType: string;
    locale: string;
}

interface PlatformInfo {
    os: string;
    arch: string;
    osVersion: string;
}

interface LocationInfo {
    timeZone: string;
    locale: string;
}

export interface StartEventData {
    extension: ExtensionInfo;
    vsCode: VscodeInfo;
    platform: PlatformInfo;
    location: LocationInfo;
}

export class ExtensionStartEvent extends BaseEvent<StartEventData> {
    public static readonly NAME = "startup";
    public static readonly ENDPOINT = "/start";
        
    constructor(payload: StartEventData){
        super(ExtensionStartEvent.NAME, ExtensionStartEvent.ENDPOINT, payload);
    }

    public static builder = async (cacheService: CacheService): Promise<ExtensionStartEvent | null> => {
        const ENVIRONMENT_INFO = "environmentInfo";
        const startEventData = getEnvironmentInfo(globalState.getExtensionContextInfo());
        const value: string | undefined = await cacheService.get(ENVIRONMENT_INFO);
        const envString = JSON.stringify(startEventData);
        const calculatedHashVal = getHashCode(envString);

        if (value != calculatedHashVal) {
            const isAdded = await cacheService.put(ENVIRONMENT_INFO, envString);
            LOGGER.log(`${ENVIRONMENT_INFO} added in cache ${isAdded ? "Successfully" : "Unsucessfully"}`);

            const startEvent: ExtensionStartEvent = new ExtensionStartEvent(startEventData);

            return startEvent;
        }
        LOGGER.log(`No change in ${ENVIRONMENT_INFO}`);
        return null;
    }

}
