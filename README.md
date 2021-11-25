# fReEFLEX GUI
[![License: Apache License 2.0](https://img.shields.io/badge/License-Apache%20License%202.0-yellow.svg)](LICENSE)

> HTML based fReEFLEX GUI based on WebHID API.

[![GUI](doc/gui.png?raw=true "GUI")](https://freeflex.github.io/fReEFLEX-GUI/)

## 📁 Download
- [online version](https://freeflex.github.io/fReEFLEX-GUI/)
- [offline package](https://github.com/fReEFLEX/fReEFLEX-GUI/releases)

## Contents
- [Download](#-download)
- [What is this?](#what-is-this)
- [Usage](#usage)
    - [1. Get started](#1-get-started)
    - [2. Functionality test](#2-functionality-test)
    - [3. Streaming mode](#3-streaming-mode)
    - [4. E2E latency mode](#4-e2e-latency-mode)
    - [5. System latency mode](#5-system-latency-mode)
        - [5.1 Mouse latency](#51-mouse-latency)
    - [6. Saving results](#6-saving-results)
- [Tips](#tips)
- [Support the fReEFLEX project](#-support-freeflex-project)
- [License](#-license)

## What is this?
fReEFLEX helps you to 
- Find the best settings for low input latency in 3D Games and debunk or proof common myth about input latency: [E2E latency mode](#4-e2e-latency-mode)
- Optimize your OS for low input latency: [System latency mode](#5-system-latency-mode)
- Measure processing delay of mice: [Mouse latency](#51-mouse-latency)

## Usage
>⚠️This GUI requires a recent Version of Chrome, Edge or any other Browser with support for **WebHID API**.

### 1. Get started
- Connect your [fReEFLEX controller](https://github.com/fReEFLEX/fReEFLEX-controller) to the device you are running the GUI on.
- [Open](https://freeflex.github.io/fReEFLEX-GUI/) the GUI.
- Click on connect and allow the GUI to access the controller.
![](doc/chrome_hid_connect.png?raw=true "WebHID Connect")

### 2. Functionality test
To make sure everything works as expected:
- Change **Mode** to System latency and **Mouse** to emulated.
- Press **FIRE** and move your mouse cursor over the click detector (black) below the button.
- On an idle system measurements should be around 1.5-3ms. ✔️
- You can proceed with either
    - integrated click detector - has a bit extra latency as it runs inside a browser 
    - [fReEFLEX clicker](https://github.com/fReEFLEX/fReEFLEX-clicker) - lowest latency for E2E (fullscreen️❗) and System latency modes
    - 🎮 FPS games or any other application that produces a bright flash on mouse click like (does not support System latency mode). 
    
![](doc/system_latency.png?raw=true "System latency")

### 3. Streaming mode
This mode plots live sensor data coming from the light sensor aswell as mouse clicks. 

- Light sensitivity line should be above light sensor readings when not clicking but below when firing.
- measures **click-to-photon latency**: mouse click ➡️ software ➡️ screen flashes ➡️ fReEFLEX controller

>When the click detection works reliably you should switch to [E2E latency mode](#4-e2e-latency-mode).   

### 4. E2E latency mode
This mode works the same as [Streaming mode](#3-streaming-mode) while not rendering any live data to save resources on your system.  

### 5. System latency mode
In this mode instead of reading data from the light sensor a hid message is sent to the [fReEFLEX controller](https://github.com/fReEFLEX/fReEFLEX-controller) when a click was detected.
This works with both the integrated click detector and [fReEFLEX clicker](https://github.com/fReEFLEX/fReEFLEX-clicker) which should be preferred.

- measures **click-to-software latency**: mouse click ➡️ software ➡️ fReEFLEX controller

>This basically is a HID round trip measurement at 1000hz polling rate plus the time it takes the software to detect a click and send a response.

#### 5.1 Mouse latency
System latency mode can also be used to measure the latency of a real mouse. 

- Measure System latency using emulated mouse.
- Measure System latency using a real mouse.

The difference between the two measurements tells you how long it took the mouse to detect a state change of the hardware switch and send a signal to your computer.
> Given that your mouse also runs at 1000Hz polling rate the difference should not be more than 1-2ms for a gaming mouse.

### 6. Saving results
Click on **save CSV** to generate a CSV containing recorded events.
> ⚠️ values in CSV are microseconds 

## Tips
- Fire at least 100 clicks to get reliable results.
>HID protocol uses a fixed polling rate. At 1000Hz polling rate every click naturally has a 0-1ms latency before being recognized by your system. You want this to average out aswell as other fluctuations happening on your system.

- use fast auto fire function in online games at your own risk, it might get you banned! Make use of training modes etc.

- to find the optimal settings for fast paced online games not only optimize for lowest input latency but also for a low fluctuation (std)

- when measuring with a real mouse
    - You can run the UI on a different system.
    - If your mouse supports changing polling rate you can observe the effect of that using the [System latency mode](#5-system-latency-mode).

## ☕ Support fReEFLEX project

[PayPal](https://paypal.me/Pmant)

## 👤 Author

[@Pmant](https://github.com/Pmant)

## 📝 License

Copyright © 2021 [Pmant](https://github.com/Pmant).

This project is [Apache License 2.0](LICENSE) licensed.


