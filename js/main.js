class EventEmitter {
    constructor() {
        this.events = {};
    }

    on(event, listener) {
        if (!(event in this.events)) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
        return () => this.removeListener(event, listener);
    }

    removeListener(event, listener) {
        if (!(event in this.events)) {
            return;
        }
        const idx = this.events[event].indexOf(listener);
        if (idx > -1) {
            this.events[event].splice(idx, 1);
        }
        if (this.events[event].length === 0) {
            delete this.events[event];
        }
    }

    emit(event, ...args) {
        if (!(event in this.events)) {
            return;
        }
        this.events[event].forEach(listener => listener(...args));
    }

    once(event, listener) {
        const remove = this.on(event, (...args) => {
            remove();
            listener(...args);
        });
    }
}

class HIDDevice extends EventEmitter {
    static deviceFilter =
        {
            vendorId: 0x2E8A,
            productId: 0x000A,
            usagePage: 0xFF00,
            usage: 0x0001,
        };
    static VERSION_MIN = 2;
    static VERSION_MAX = 2;
    static report_length = 14;
    static MAGIC_PACKET = 0x66726565;
    static requestParams = {filters: [HIDDevice.deviceFilter]};
    static outputReportId = 0x03;
    static serial_baud = 250000;

    static report_offsets =
        {
            TIMESTAMP: 0,
            KEY: 4,
            SET: 5,
            VALUE: 6,
            VALUE_2: 10,
        };

    static report_keys =
        {
            STREAM: 0,
            MAGIC_PACKET: 1,
            MODE: 2,
            EVENT: 3,
            TIMEOUT: 4,
            LIGHT_SENSITIVITY: 5,
            USE_HID_MOUSE: 6,
            AUTOFIRE_DELAY: 7,
            AUTOFIRE_HOLD: 8,
            AUTOFIRE_REMAINING: 9,
            CLICK_RECEIVED: 10,
            MESSAGE: 20,
            ERROR: 21,
        };


    constructor() {
        super();
        this.device = null;
        this.serial_device = null;
        this.initialized = false;

        this.outputReport = new Uint8Array(HIDDevice.report_length);

        //int <-> byte value conversion
        this.valueBuffer = new ArrayBuffer(8);
        this.valueUint32 = new Uint32Array(this.valueBuffer);
        this.valueUint8 = new Uint8Array(this.valueBuffer);

        this.pico = {
            mode: 0,
            light_sensitivity: 0,
            use_hid_mouse: true,
            autofire_delay: 0,
            autofire_hold: 0,
            autofire_remaining: 0,
        }

        //last mouse button state
        this.is_click_last = false;
    }

    async start() {
        if ("hid" in navigator) {
            //setup device connection handlers
            navigator.hid.addEventListener("connect", this.handleConnectedDevice.bind(this));
            navigator.hid.addEventListener("disconnect", this.handleDisconnectedDevice.bind(this));

            //request and initialize HID device
            this.requestHID().then(() => console.log('HID device ready')).catch((e) => console.log(e));
        } else {
            alert("Browser does not support WebHID API. Browsers known to work are latest versions of Chrome and Edge.");
        }
    }

    async requestHID() {
        try {
            const devices = await navigator.hid.requestDevice(HIDDevice.requestParams);
            this.device = devices[0];
        } catch (error) {
            throw(error);
        }

        if (!this.device) {
            throw ("no hid device was selected");
        } else {
            console.log("found hid device");
        }
        await this.initializeHID();
    }

    async initializeHID() {
        if (this.device && !this.device.opened) {
            await this.device.open();
            this.device.addEventListener("inputreport", this.handleInputReport.bind(this));
            await this.sendHID(HIDDevice.report_keys.MAGIC_PACKET);
        }
    }

    async requestSerial() {
        if ("serial" in navigator) {

        } else {
            alert("Browser does not support WebSerial API. Browsers known to work are latest versions of Chrome and Edge.");
            return;
        }
        //request and initialize HID device
        try {
            this.serial_device = await navigator.serial.requestPort([
                { usbVendorId: HIDDevice.deviceFilter.vendorId, usbProductId: HIDDevice.deviceFilter.productId }
            ]);
        } catch (error) {
            throw(error);
        }

        if (!this.serial_device) {
            throw ("no serial device was selected");
        }
        try {
            await this.initializeSerial();
        } catch (e) {
            throw (e);
        }
    }

    async initializeSerial() {
        if (this.serial_device) {
            await this.serial_device.open({ baudRate: HIDDevice.serial_baud });
        }
    }

    closeSerial() {
        if (this.serial_device) {
            this.serial_device.close().then(() => this.serial_device = null);
        }
        this.serial_device = null;
    }

    closeHid() {
        if (this.device) {
            this.device.close().then(() => this.device = null);
        }
        this.device = null;
    }

    async sendHID(key, value = null, value_2 = null) {
        if (!this.initialized && key !== HIDDevice.report_keys.MAGIC_PACKET) {
            return;
        }
        this.outputReport[HIDDevice.report_offsets.KEY] = key;
        if (value !== null) {
            this.outputReport[HIDDevice.report_offsets.SET] = 0x01;
            this.valueUint32[0] = value;
            this.valueUint32[1] = value_2 !== null ? value_2 : 0;
            this.outputReport.set(this.valueUint8, HIDDevice.report_offsets.VALUE);
        } else {
            this.outputReport[HIDDevice.report_offsets.SET] = 0x00;
        }
        await this.device.sendReport(HIDDevice.outputReportId, this.outputReport);
    }

    extractUint32(report, offset) {
        this.valueUint8.set(report.subarray(offset, offset + 4));
        return this.valueUint32[0];
    }

    processReport(report) {
        let key = report[HIDDevice.report_offsets.KEY];
        //skip all input until initialized
        if (!this.initialized && key !== HIDDevice.report_keys.MAGIC_PACKET) {
            return;
        }

        //let timestamp = this.extractUint32(report, HIDDevice.report_offsets.TIMESTAMP, 4);
        //let set = report[HIDDevice.report_offsets.SET];
        let value = this.extractUint32(report, HIDDevice.report_offsets.VALUE);
        let value_2 = this.extractUint32(report, HIDDevice.report_offsets.VALUE_2);
        //console.log(`received report:\ntimestamp: ${timestamp}\nkey: ${key}\nset: ${set}\nvalue: ${value}`);

        if (key === 0) {
            if (!!value_2 !== this.is_click_last) {
                this.emit("is_click", !!value_2);
                this.is_click_last = !!value_2;
            }
            this.emit("light_sensor", value);
            return;
        }

        console.log(`received report:\ntimestamp: ${this.extractUint32(report, HIDDevice.report_offsets.TIMESTAMP, 4)}\nkey: ${key}\nset: ${report[HIDDevice.report_offsets.SET]}\nvalue: ${value}\nvalue_2: ${value_2}`);

        switch (key) {
            case HIDDevice.report_keys.MAGIC_PACKET:
                if (!this.initialized && value === HIDDevice.MAGIC_PACKET) {
                    console.log("received MAGIC PACKET, version " + value_2);
                    if (value_2 < HIDDevice.VERSION_MIN || value_2 > HIDDevice.VERSION_MAX) {
                        console.log("controller version incompatible, please update.");
                        alert("controller version incompatible!");
                        break;
                    }
                    this.initialized = true;
                    this.emit("initialized", true);
                    this.requestSettings().then(() => console.log("requested settings"));
                }
                break;
            case HIDDevice.report_keys.MODE:
                this.pico.mode = value;
                console.log("mode changed to " + this.mode);
                this.emit("mode", this.mode);
                break;
            case HIDDevice.report_keys.LIGHT_SENSITIVITY:
                this.pico.light_sensitivity = value;
                console.log("light sensitivity changed to " + this.light_sensitivity);
                this.emit("light_sensitivity", this.light_sensitivity);
                break;
            case HIDDevice.report_keys.USE_HID_MOUSE:
                this.pico.use_hid_mouse = !!value;
                console.log("use hid mouse changed to " + this.use_hid_mouse);
                this.emit("use_hid_mouse", this.use_hid_mouse);
                break;
            case HIDDevice.report_keys.AUTOFIRE_DELAY:
                this.pico.autofire_delay = value;
                console.log("autofire delay changed to " + this.autofire_delay);
                this.emit("autofire_delay", this.autofire_delay);
                break;
            case HIDDevice.report_keys.AUTOFIRE_HOLD:
                this.pico.autofire_hold = value;
                console.log("autofire hold changed to " + this.autofire_hold);
                this.emit("autofire_hold", this.autofire_hold);
                break;
            case HIDDevice.report_keys.AUTOFIRE_REMAINING:
                this.pico.autofire_remaining = value;
                //console.log("autofire remaining changed to " + this.autofire_remaining);
                this.emit("autofire_remaining", this.autofire_remaining);
                break;
            case HIDDevice.report_keys.EVENT:
                //console.log("received event: " + (value / 1000).toFixed(2) + "ms");
                this.emit("event", value);
                break;
            case HIDDevice.report_keys.TIMEOUT:
                //console.log("received event timeout: " + (value / 1000).toFixed(2) + "ms");
                this.emit("timeout", value);
                break;
            default:
                break;
        }
    }

    async requestSettings() {
        await this.sendHID(HIDDevice.report_keys.MODE);
        await this.sendHID(HIDDevice.report_keys.LIGHT_SENSITIVITY);
        await this.sendHID(HIDDevice.report_keys.USE_HID_MOUSE);
        await this.sendHID(HIDDevice.report_keys.AUTOFIRE_DELAY);
        await this.sendHID(HIDDevice.report_keys.AUTOFIRE_HOLD);
    }

    //event handlers
    handleInputReport(e) {
        if (e.data.buffer.byteLength !== HIDDevice.report_length) {
            return;
        }
        this.processReport(new Uint8Array(e.data.buffer));
    }

    handleConnectedDevice(e) {
        console.log("Device connected: " + e.device.productName);
        navigator.hid.getDevices().then((devices) => {
            this.device = devices[0];
            this.initializeHID().then(() => console.log('HID device reconnected')).catch((e) => console.log(e));
        });
    }

    handleDisconnectedDevice(e) {
        console.log("Device disconnected: " + e.device.productName);
        this.emit("initialized", false);
        this.initialized = false;
        this.closeSerial();
        this.closeHid();
    }

    sendClickReceived() {
        if (this.serial_device) {
            try {
                const writer = this.serial_device.writable.getWriter();
                const data = new Uint8Array([0]);
                writer.write(data).then( () => writer.releaseLock());
            } catch (e) {
                console.log(e);
            }
        } else {
            this.sendHID(HIDDevice.report_keys.CLICK_RECEIVED, 1).then();
        }
    }

    //getters & setters
    get mode() {
        return this.pico.mode;
    }

    set mode(mode) {
        this.sendHID(HIDDevice.report_keys.MODE, mode).then();
    }

    get light_sensitivity() {
        return this.pico.light_sensitivity;
    }

    set light_sensitivity(sensitivity) {
        this.sendHID(HIDDevice.report_keys.LIGHT_SENSITIVITY, sensitivity).then();
    }

    get use_hid_mouse() {
        return this.pico.use_hid_mouse;
    }

    set use_hid_mouse(use_hid) {
        this.sendHID(HIDDevice.report_keys.USE_HID_MOUSE, use_hid).then();
    }

    get autofire_delay() {
        return this.pico.autofire_delay;
    }

    set autofire_delay(delay) {
        this.sendHID(HIDDevice.report_keys.AUTOFIRE_DELAY, delay).then();
    }

    get autofire_hold() {
        return this.pico.autofire_hold;
    }

    set autofire_hold(hold) {
        this.sendHID(HIDDevice.report_keys.AUTOFIRE_HOLD, hold).then();
    }

    get autofire_remaining() {
        return this.pico.autofire_remaining;
    }

    set autofire_remaining(remaining) {
        this.sendHID(HIDDevice.report_keys.AUTOFIRE_REMAINING, remaining).then();
    }
}

class GUI {
    static INPUT_DELAY = 1000;

    constructor(hidDevice) {
        this.freeflexDevice = hidDevice;
        this.disableAllSettings();

        this.filters = {
            min: 0,
            max: 250,
        }
        this.stats = {
            events: [],
            filtered: [],
            timeouts: 0,
            min: 0,
            max: 0,
            sum: 0,
            mean: 0,
        }
        this.detector = {
            low: "#000000",
            high: "#ffffff",
        }

        this.enableTooltips();

        this.setupListeners();
    }

    enableTooltips() {
        let tooltipTriggerList = [].slice.call(document.querySelectorAll('[data-bs-toggle="tooltip"]'))
        tooltipTriggerList.map(function (tooltipTriggerEl) {
            return new bootstrap.Tooltip(tooltipTriggerEl)
        })
    }

    setupListeners() {
        //connect button
        $("#connect_button").on("click", () => {
            this.freeflexDevice.start();
        });

        //connect serial button
        $("#connect_serial_button").on("click", () => {
            this.freeflexDevice.requestSerial().then(() => {
                console.log("connected to serial port");
                $("#connect_serial_button").prop("disabled", true).addClass("btn-success");
            }).catch((e) => console.log(e));
        });

        //device init
        this.freeflexDevice.on("initialized", (isInitialized) => {
            if (isInitialized) {
                $("#connect_button").removeClass("btn-primary btn-success").addClass("btn-success").prop("disabled", true).text("connected");
                $('input[type=range][id=autofire_clicks]').prop("disabled", false);
                $("#autofire_button").prop("disabled", false);
            } else {
                $("#connect_button").removeClass("btn-primary btn-success").addClass("btn-primary").prop("disabled", false).text("connect");
                $("#connect_serial_button").removeClass("btn-success");
                this.enableAfterAF();
                this.disableAllSettings();
            }
        })

        //mode
        let serial_button = $('#connect_serial_button');
        this.freeflexDevice.on("mode", (mode) => {
            $('input[type=radio][name=mode]').prop("checked", false).prop("disabled", false);
            serial_button.prop("disabled", true).removeClass("btn-success");

            if (mode === 0) {
                $('input[type=radio][id=e2e_latency_stream]').prop("checked", true);
                this.freeflexDevice.closeSerial();
            } else if (mode === 1) {
                $('input[type=radio][id=e2e_latency]').prop("checked", true);
                this.freeflexDevice.closeSerial();
            } else if (mode === 2) {
                $('input[type=radio][id=system_latency]').prop("checked", true);
                serial_button.prop("disabled", false).removeClass("btn-success");
            } else if (mode === 4) {
                $('input[type=radio][id=light_frequency]').prop("checked", true);
            } else {
                alert("invalid mode!");
            }
            this.updateAFHighlighting();
        });
        let timer_mode;
        $('input[type=radio][name=mode]').on("change", () => {
            let new_mode = $('input[type=radio][name=mode]:checked').val();
            clearTimeout(timer_mode);
            timer_mode = setTimeout(() => {
                this.freeflexDevice.mode = new_mode;
                $('input[type=radio][name=mode]').prop("disabled", true);
            }, GUI.INPUT_DELAY);
        });

        //light sensitivity
        let input_light = $('input[type=range][id=light_sensitivity]');
        this.freeflexDevice.on("light_sensitivity", (sensitivity) => {
            input_light.val(sensitivity).prop("disabled", false).next().text(sensitivity);
        });
        let timer_light;
        input_light.on("input", () => {
            let new_sensitivity = input_light.val();
            input_light.next().text(new_sensitivity);
            clearTimeout(timer_light);
            timer_light = setTimeout(() => {
                this.freeflexDevice.light_sensitivity = new_sensitivity;
                input_light.prop("disabled", true);
            }, GUI.INPUT_DELAY);
        });

        //mouse
        this.freeflexDevice.on("use_hid_mouse", (use_hid) => {
            $('input[type=radio][name=mouse]').prop("checked", false).prop("disabled", false);
            if (use_hid) {
                $('input[type=radio][id=mouse_emulated]').prop("checked", true);
            } else {
                $('input[type=radio][id=mouse_sensor]').prop("checked", true);
            }
            this.updateAFHighlighting();
        });
        let timer_mouse;
        $('input[type=radio][name=mouse]').on("change", () => {
            let new_hid = $('input[type=radio][name=mouse]:checked').val();
            clearTimeout(timer_mouse);
            timer_mouse = setTimeout(() => {
                this.freeflexDevice.use_hid_mouse = new_hid;
                $('input[type=radio][name=mouse]').prop("disabled", true);
            }, GUI.INPUT_DELAY);
        });

        //autofire delay
        let input_autofire_delay = $('input[type=range][id=autofire_delay]');
        this.freeflexDevice.on("autofire_delay", (delay) => {
            input_autofire_delay.val(delay).prop("disabled", false).next().find('span').text(delay);
        });
        let timer_delay;
        input_autofire_delay.on("input", () => {
            let new_delay = input_autofire_delay.val();
            input_autofire_delay.next().find('span').text(new_delay);
            clearTimeout(timer_delay);
            timer_delay = setTimeout(() => {
                this.freeflexDevice.autofire_delay = new_delay;
                input_autofire_delay.prop("disabled", true);
            }, GUI.INPUT_DELAY);
        });

        //autofire hold
        let input_autofire_hold = $('input[type=range][id=autofire_hold]');
        this.freeflexDevice.on("autofire_hold", (hold) => {
            input_autofire_hold.val(hold).prop("disabled", false).next().find('span').text(hold);
        });
        let timer_hold;
        input_autofire_hold.on("input", () => {
            let new_hold = input_autofire_hold.val();
            input_autofire_hold.next().find('span').text(new_hold);
            clearTimeout(timer_hold);
            timer_hold = setTimeout(() => {
                this.freeflexDevice.autofire_hold = new_hold;
                input_autofire_hold.prop("disabled", true);
            }, GUI.INPUT_DELAY);
        });

        //autofire clicks
        let input_autofire_clicks = $('input[type=range][id=autofire_clicks]');
        input_autofire_clicks.on("input", () => {
            let new_clicks = input_autofire_clicks.val();
            input_autofire_clicks.next().text(new_clicks);
            $('#autofire_progress').attr("aria-valuemax", new_clicks);
        });

        //autofire remaining
        let autofire_progress = $('#autofire_progress');
        autofire_progress.css('transition-duration', '0.1s').css('width', '0%');
        this.freeflexDevice.on("autofire_remaining", (remaining) => {
            let max = autofire_progress.attr('aria-valuemax');
            autofire_progress.attr('aria-valuenow', max - remaining).css('width', 100 * (max - remaining) / max + '%');
            if (remaining === 0) {
                this.enableAfterAF();
            }
        });

        //autofire button
        let autofire_button = $("#autofire_button");
        autofire_button.on("click", () => {
            this.disableWhileAF();
            let start_in = 5;
            setTimeout(() => {
                this.freeflexDevice.autofire_remaining = autofire_progress.attr('aria-valuemax');
            }, start_in * 1000);
            autofire_progress.css('width', start_in / 5 * 100 + '%').addClass("bg-danger").children().text(start_in);
            let countdown = setInterval(() => {
                start_in--;
                autofire_progress.css('width', start_in / 5 * 100 + '%').children().text(start_in);
                if (start_in === 0) {
                    autofire_progress.attr('aria-valuenow', 0).css('width', 0 + '%').removeClass("bg-danger").children().text('');
                    clearInterval(countdown);
                }
            }, 1000);
        });

        //click detector
        const detector_canvas = document.querySelector('#click_detector');
        const detector_ctx = detector_canvas.getContext('2d', {
            desynchronized: true,
            preserveDrawingBuffer: false,
            alpha: false,
            // Other options. See below.
        });
        if (typeof detector_ctx.getContextAttributes === "function" && detector_ctx.getContextAttributes().desynchronized) {
            console.log('Low latency canvas supported.');
        } else {
            console.log('Low latency canvas not supported.');
        }
        detector_ctx.fillStyle = 'black';
        detector_ctx.fillRect(0, 0, detector_canvas.width, detector_canvas.height);
        let click_detector = $("#click_detector");

        this.freeflexDevice.on("mode", (mode) => {
            click_detector.off();
            if (mode === 2) {
                click_detector.on("mousedown", () => {
                    this.freeflexDevice.sendClickReceived();
                });
            } else {
                click_detector.on("mousedown", () => {
                    detector_ctx.fillStyle = this.detector.high;
                    detector_ctx.fillRect(0, 0, detector_canvas.width, detector_canvas.height);
                });
                click_detector.on("mouseup", () => {
                    detector_ctx.fillStyle = this.detector.low;
                    detector_ctx.fillRect(0, 0, detector_canvas.width, detector_canvas.height);
                });
                click_detector.on("mouseleave", () => {
                    detector_ctx.fillStyle = this.detector.low;
                    detector_ctx.fillRect(0, 0, detector_canvas.width, detector_canvas.height);
                });
            }
        });


        //stats
        //on event
        let event_log = $("#event-log");
        this.freeflexDevice.on("event", (us) => {
            if (this.freeflexDevice.mode === 4) event_log.prepend("<p>" + (us).toFixed(0) + "Hz</p>");
            else event_log.prepend("<p>" + (us / 1000).toFixed(2) + "ms</p>");
            if (!this.filterEvent(us)) {
                this.stats.events.push(us);
                this.stats.min = this.stats.min ? Math.min(us, this.stats.min) : us;
                this.stats.max = Math.max(us, this.stats.max);
                this.stats.sum += us;
                this.stats.mean = this.stats.sum / this.stats.events.length;
            } else {
                this.stats.filtered.push(us);
            }
            this.updateStats();
        });

        //on timeout
        this.freeflexDevice.on("timeout", () => {
            this.stats.timeouts++;
            this.updateStats();
        });

        //filters
        let input_filter_min = $('input[type=range][id=filter_min]');
        let input_filter_max = $('input[type=range][id=filter_max]');

        input_filter_min.on("input", () => {
            let new_min = input_filter_min.val();
            input_filter_min.next().text(new_min);
            this.filters.min = parseFloat(new_min);
            if (this.filters.max <= this.filters.min) {
                input_filter_max.val(Math.ceil(this.filters.min + 0.1)).trigger("input");
            }
        });
        input_filter_max.on("input", () => {
            let new_max = input_filter_max.val();
            input_filter_max.next().text(new_max);
            this.filters.max = parseFloat(new_max);
            if (this.filters.max <= this.filters.min) {
                input_filter_min.val(this.filters.max - 0.1).trigger("input");
            }
        });

        //reset button
        let reset_button = $("#reset_button");
        reset_button.on("click", () => {
            this.resetStats();
            $("#event-log").html("");
        });

        //save button
        let save_button = $("#save_button");
        save_button.on("click", () => {
            let csvContent = "data:text/csv;charset=utf-8,";
            csvContent += this.stats.events.join("\r\n");
            let encodedUri = encodeURI(csvContent);
            window.open(encodedUri);
            let link = document.createElement("a");
            link.setAttribute("href", encodedUri);
            link.setAttribute("download", Date.now() + ".csv");
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    }

    updateAFHighlighting() {
        let mouseMode = $('input[type=radio][name=mouse]:checked').val();
        if (mouseMode === "1") {
            $('#autofire_delay').parent().addClass("border-3 border-warning").removeClass("p-3").css({"padding": "calc(1rem - 2px)"});
        } else {
            $('#autofire_delay').parent().removeClass("border-3 border-warning").addClass("p-3").css("padding", '');
        }
    }

    filterEvent(us) {
        return us > this.filters.max * 1000 || us < this.filters.min * 1000;
    }

    resetStats() {
        this.stats = {
            events: [],
            filtered: [],
            timeouts: 0,
            min: 0,
            max: 0,
            sum: 0,
            mean: 0,
        };
        this.updateStats();
    }

    updateStats() {
        $(".stats-events").text(this.stats.events.length);
        $(".stats-filtered").text(this.stats.filtered.length);
        $(".stats-timeouts").text(this.stats.timeouts);
        $(".stats-min").text((this.stats.min / 1000).toFixed(2));
        $(".stats-max").text((this.stats.max / 1000).toFixed(2));
        $(".stats-mean").text((this.stats.mean / 1000).toFixed(2));
        let std = 0;
        if (this.stats.events.length)
            std = Math.sqrt(
                this.stats.events.reduce((arr, val) => arr.concat(Math.pow((val - this.stats.mean), 2)), [])
                    .reduce((arr, val) => arr + val, 0) / this.stats.events.length
            );
        $(".stats-std").text((std / 1000).toFixed(2));
    }

    disableAllSettings() {
        $(".container input:not(#filter_min, #filter_max)").prop("disabled", true);
        $(".container button:not(#connect_button, #reset_button, #save_button)").prop("disabled", true);
    }

    disableWhileAF() {
        this.tempInput = $("input:enabled");
        this.tempButton = $("button:enabled");
        this.tempInput.prop("disabled", true);
        this.tempButton.prop("disabled", true);
        $("#click_detector").addClass("border border-5 border-info");
    }

    enableAfterAF() {
        $("#click_detector").removeClass("border border-5 border-info");
        if (this.tempInput)
            this.tempInput.prop("disabled", false);
        if (this.tempButton)
            this.tempButton.prop("disabled", false);
        this.tempInput = null;
        this.tempButton = null;
    }
}

class Plot {
    constructor(hidDevice) {
        this.hidDevice = hidDevice;
        this.initialize();
    }

    initialize() {
        this.canvas = document.getElementById("plot");
        let devicePixelRatio = window.devicePixelRatio || 1;
        this.canvas.width = this.canvas.clientWidth * devicePixelRatio;
        this.canvas.height = this.canvas.clientHeight * devicePixelRatio;

        let numX = this.canvas.width / 2;

        this.wglp = new WebglPlotBundle.WebglPlot(this.canvas);

        //light sensor line
        this.line_light = new WebglPlotBundle.WebglLine(new WebglPlotBundle.ColorRGBA(1, 1, 0, 1), numX);
        this.line_light.offsetY = -1;
        this.line_light.arrangeX();
        this.line_light.constY(0);
        this.wglp.addLine(this.line_light);

        //click line
        this.line_click = new WebglPlotBundle.WebglLine(new WebglPlotBundle.ColorRGBA(0, 1, 1, 0.5), numX);
        this.line_click.offsetY = -1;
        this.line_click.arrangeX();
        this.line_click.constY(0);
        this.wglp.addLine(this.line_click);
        this.is_click = false;

        //light sensitivity line
        this.line_sensitivity = new WebglPlotBundle.WebglLine(new WebglPlotBundle.ColorRGBA(0.5, 0.5, 0, 1), 2);
        this.line_sensitivity.offsetY = -1;
        this.line_sensitivity.xy = new Float32Array([-1, 0, 1, 0]);
        this.line_sensitivity.constY(0);
        this.wglp.addLine(this.line_sensitivity);

        this.wglp.update();
        requestAnimationFrame(() => {
        });

        this.hidDevice.on("is_click", (value) => {
            this.is_click = value;
        });

        this.hidDevice.on("light_sensor", (value) => {
            this.line_light.shiftAdd([value / 2048]);
            this.line_click.shiftAdd([this.is_click ? 1.9 : 0]);
            this.wglp.update();
            requestAnimationFrame(() => {
            });
        });


        this.hidDevice.on("light_sensitivity", (value) => {
            this.line_sensitivity.constY(value / 2048);
        });

        this.hidDevice.on("mode", (value) => {
            if (value === 0) {
                this.line_sensitivity.constY(this.hidDevice.light_sensitivity / 2048);
            } else {
                this.line_light.constY(0);
                this.line_click.constY(0);
                this.line_sensitivity.constY(0);
            }
            this.wglp.update();
            requestAnimationFrame(() => {
            });
        });
    }
}












