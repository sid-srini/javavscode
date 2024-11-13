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
import { getCurrentUTCDateInSeconds } from "../utils";
import { TelemetryEventQueue } from "./telemetryEventQueue";
import { CacheService, TelemetryReporter } from "../types";
import { LOGGER } from "../../logger";
import { isError } from "../../utils";
import { BaseEvent } from "../events/baseEvent";
import { ExtensionCloseEvent } from "../events/close";
import { ExtensionStartEvent } from "../events/start";
import { TelemetryRetry } from "./telemetryRetry";
import { JdkFeatureEvent } from "../events/jdkFeature";
import { PostTelemetry, TelemetryPostResponse } from "./postTelemetry";

export class TelemetryReporterImpl implements TelemetryReporter {
    private activationTime: number = getCurrentUTCDateInSeconds();
    private disableReporter: boolean = false;
    private postTelemetry: PostTelemetry = new PostTelemetry();

    constructor(
        private queue: TelemetryEventQueue,
        private retryManager: TelemetryRetry,
        private cacheService: CacheService,
    ) {
        this.retryManager.registerCallbackHandler(this.sendEvents);
    }

    public startEvent = async (): Promise<void> => {
        const extensionStartEvent = await ExtensionStartEvent.builder(this.cacheService);
        if(extensionStartEvent != null){
            this.addEventToQueue(extensionStartEvent);
        } 
    }

    public closeEvent = (): void => {
        const extensionCloseEvent = ExtensionCloseEvent.builder(this.activationTime);
        this.addEventToQueue(extensionCloseEvent);

        this.sendEvents();
    }

    public addEventToQueue = (event: BaseEvent<any>): void => {
        if (!this.disableReporter) {
            this.queue.enqueue(event);
            if (this.retryManager.isQueueOverflow(this.queue.size())) {
                this.sendEvents();
            }
        }
    }

    private sendEvents = async (): Promise<void> => {
        try {
            if(!this.queue.size()){
                return;
            }
            const eventsCollected = this.queue.flush();
            this.retryManager.clearTimer();

            const transformedEvents = this.transformEvents(eventsCollected);

            const response = await this.postTelemetry.post(transformedEvents);

            this.handlePostTelemetryResponse(response);

            this.retryManager.startTimer();
        } catch (err: any) {
            this.disableReporter = true;
            LOGGER.error(`Error while sending telemetry: ${isError(err) ? err.message : err}`);
        }
    }
    
    private transformEvents = (events: BaseEvent<any>[]): BaseEvent<any>[] => {
        const jdkFeatureEvents = events.filter(event => event.NAME === JdkFeatureEvent.NAME);
        const concatedEvents = JdkFeatureEvent.concatEvents(jdkFeatureEvents);
        const removedJdkFeatureEvents = events.filter(event => event.NAME !== JdkFeatureEvent.NAME);
        
        return [...removedJdkFeatureEvents, ...concatedEvents];
    }

    private handlePostTelemetryResponse = (response: TelemetryPostResponse) => {
        const eventsToBeEnqueued = this.retryManager.eventsToBeEnqueuedAgain(response);
        this.queue.concatQueue(eventsToBeEnqueued);
    }
}