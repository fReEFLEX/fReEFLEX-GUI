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
    - [6. Light frequency](#6-light-frequency)
    - [7. Saving results](#7-saving-results)
- [Tips](#tips)
- [Support fReEFLEX project](#-support-freeflex-project)
- [License](#-license)

## What is fReEFLEX?
fReEFLEX helps you to 
- Find the best settings for low input latency in 3D Games and debunk or proof common myth about input latency: [E2E latency mode](#4-e2e-latency-mode)
- Optimize your OS for low input latency: [System latency mode](#5-system-latency-mode)
- Measure processing delay of mice: [Mouse latency](#51-mouse-latency)
- Measure the [frequency](#6-light-frequency) of pulsed light sources, e.g. backlight strobing, dimmed LEDs.


The fReEFLEX project includes
- [Controller firmware](https://github.com/fReEFLEX/fReEFLEX-controller/releases) - copy this on your Raspberry Pi Pico
- [GUI](https://github.com/fReEFLEX/fReEFLEX-GUI/) - to operate the controller
- [3D Application](https://github.com/fReEFLEX/fReEFLEX-clicker/) - 3D application for E2E latency measurement 


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
    - [fReEFLEX clicker](https://github.com/fReEFLEX/fReEFLEX-clicker) - very low latency, adjustable FPS
    - 🎮 FPS games or any other application that produces a bright flash on mouse click
    
![](doc/system_latency.png?raw=true "System latency")

### 3. Streaming mode
This mode plots live sensor data coming from the light sensor aswell as mouse clicks. 

- Light sensitivity line should be above light sensor readings when not clicking but below when firing.
- Measures **click-to-photon latency**: mouse click ➡️ software ➡️ screen flashes ➡️ fReEFLEX controller

>When the click detection works reliably you should switch to [E2E latency mode](#4-e2e-latency-mode).   

### 4. E2E latency mode
This mode works the same as [Streaming mode](#3-streaming-mode) while not rendering any live data to save resources on your system.  

### 5. System latency mode
In this mode instead of reading data from a light sensor a message is sent directly to the [fReEFLEX controller](https://github.com/fReEFLEX/fReEFLEX-controller) when a click was detected.
This works with both the integrated click detector and [fReEFLEX clicker](https://github.com/fReEFLEX/fReEFLEX-clicker).

- Integrated click detector has a bit extra latency as it runs inside a browser. Will fall back to hid when not connected to serial port.
- Measures **click-to-software latency**: mouse click ➡️ software ➡️ fReEFLEX controller
- With enough measurements taken: 
    - ```mininum latency = min``` 
    - ```average latency = mean - 500/(polling rate)```
    - most likely ```mininum latency ≈ average latency``` 

>At 1000Hz polling rate there is a 0-1ms delay (≃0.5ms) before your OS is able to receive a mouse click. Serial port latency should be insignificant. 

#### 5.1 Mouse latency
System latency mode can also be used to measure the latency of a real mouse. 

- Measure System latency using emulated mouse.
- Measure System latency using a real mouse.

The difference between these two measurements tells you how long it took the mouse to detect a state change of the hardware switch and send a signal to your computer.
>Given that your mouse also runs at 1000Hz polling rate the difference should not be more than 1-2ms for a gaming mouse.

### 6. Light frequency
This mode measures the frequency of pulsed light sources like backlight strobing on a monitor or dimmed LED lights.
>The light sensor runs at 50 kHz, thus the absolute maximum frequency it can measure is 25 kHz.

### 7. Saving results
Click on **save CSV** to generate a CSV containing recorded events.
>⚠️ values in CSV are microseconds 

## Tips
- Fire at least 100 clicks to get reliable results.
  >HID protocol uses a fixed polling rate. At 1000Hz polling rate every click naturally has a 0-1ms latency before being recognized by your system. You want this to average out aswell as other fluctuations happening on your system.

- Use fast auto fire function in online games at your own risk, it might get you banned! Make use of training modes etc.

- To find the optimal settings for fast paced online games predictability is important! Do not only optimize for lowest latency but also for low fluctuation (std).

- When measuring with a real mouse
    - You can run the UI on a different system.
    - If your mouse supports changing polling rate you can observe the effect of that using the [System latency mode](#5-system-latency-mode).

## ☕ Support fReEFLEX project

[PayPal](https://paypal.me/Pmant)

## 👤 Author

[@Pmant](https://github.com/Pmant)

## 📝 License

Copyright © 2021 [Pmant](https://github.com/Pmant).

This project is [Apache License 2.0](LICENSE) licensed.


