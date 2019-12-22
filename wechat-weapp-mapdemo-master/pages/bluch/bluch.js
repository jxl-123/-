function inArray(arr, key, val) {
  for (let i = 0; i < arr.length; i++) {
    if (arr[i][key] === val) {
      return i;
    }
  }
  return -1;
}
// ArrayBuffer转16进度字符串示例
function ab2hex(buffer) {
  var hexArr = Array.prototype.map.call(
    new Uint8Array(buffer),
    function (bit) {
      return ('00' + bit.toString(16)).slice(-2)
}
)
return hexArr.join("");
}
export default {
  data() {
    return {
      devices: [],
      discoveryStarted: false,
      connected: false,
      chs: [],
      deviceId: '',
      serviceId: "",
      characteristicId: '',
      name: '',
      canWrite: false,
    }
  },
  computed: {
  },
  methods: {
    // 初始化蓝牙模块
    openBluetoothAdapter() {
      let that = this;
      uni.openBluetoothAdapter({
        success: (res) => {
          console.log('openBluetoothAdapter success', res)
          //获取本机蓝牙适配器状态
          uni.getBluetoothAdapterState({//蓝牙的匹配状态
            success(res1) {
              console.log(res1, "本机设备的的蓝牙已打开")
              that.startBluetoothDevicesDiscovery()
            },
            fail(error) {
              uni.showToast({ icon: 'none', title: '查看手机蓝牙是否打开' });
            }
          })
        },
        fail: (res) => {
          if (res.errCode === 10001) {
            //监听蓝牙适配器状态变化事件
            uni.onBluetoothAdapterStateChange(function (res) {
              console.log('onBluetoothAdapterStateChange', res)
              if (res.available) {//手机蓝牙已经打开
                that.startBluetoothDevicesDiscovery()
              }
            })
          }
        }
      })
    },
    // 开始搜寻附近的蓝牙外围设备。此操作比较耗费系统资源，请在搜索并连接到设备后调用 wx.stopBluetoothDevicesDiscovery 方法停止搜
    startBluetoothDevicesDiscovery() {
      if (this.discoveryStarted) {
        return
      }
      this.discoveryStarted = true
      uni.startBluetoothDevicesDiscovery({
        allowDuplicatesKey: true,
        success: (res) => {
          console.log('startBluetoothDevicesDiscovery success', res)
          this.onBluetoothDeviceFound()
        },
      })
    },
    //停止搜寻附近的蓝牙外围设备。若已经找到需要的蓝牙设备并不需要继续搜索时，建议调用该接口停止蓝牙搜索
    stopBluetoothDevicesDiscovery() {
      wx.stopBluetoothDevicesDiscovery()
    },
    // 监听寻找到新设备的事件
    onBluetoothDeviceFound() {
      uni.onBluetoothDeviceFound((res) => {
        console.log(res, "onBluetoothDeviceFound")
        res.devices.forEach(device => {
          if (!device.name) {
            return
          }
          const foundDevices = this.devices
          const idx = inArray(foundDevices, 'deviceId', device.deviceId)
          console.log(idx, 'idx');
          const data = {}
          if (idx === -1) {
            this.devices.push(device);
          } else {
            this.devices[idx] = device
          }
          console.log(this.devices, "idx");
        })
      })
    },
    // 连接低功耗蓝牙设备。deviceId用于区分设备的 id
    createBLEConnection(ds) {
      const deviceId = ds.deviceId
      const name = ds.name || ds.localName;
      uni.createBLEConnection({
        deviceId: deviceId,
        success: (res) => {
          this.connected = true;
          this.name = name;
          this.deviceId = deviceId;
          this.getBLEDeviceServices(deviceId)
        }
      })
      this.stopBluetoothDevicesDiscovery()
    },
    // 断开与低功耗蓝牙设备的连接。 deviceId用于区分设备的 id
    closeBLEConnection() {
      uni.closeBLEConnection({
        deviceId: this.deviceId
      })
      this.connected = false;
      this.chs = [];
      this.canWrite = false;
    },
    //获取蓝牙设备所有服务(service)。 deviceId蓝牙设备 id
    getBLEDeviceServices(deviceId) {
      uni.getBLEDeviceServices({
        deviceId,
        success: (res) => {
          for (let i = 0; i < res.services.length; i++) {
            if (res.services[i].isPrimary) {
              this.getBLEDeviceCharacteristics(deviceId, res.services[i].uuid)
              return
            }
          }
        }
      })
    },
    //获取蓝牙设备某个服务中所有特征值(characteristic)
    getBLEDeviceCharacteristics(deviceId, serviceId) {
      uni.getBLEDeviceCharacteristics({
        deviceId,
        serviceId,
        success: (res) => {
          console.log('getBLEDeviceCharacteristics success', res.characteristics)
          for (let i = 0; i < res.characteristics.length; i++) {
            let item = res.characteristics[i]
            if (item.properties.read) {
              uni.readBLECharacteristicValue({ //读取低功耗蓝牙设备的特征值的二进制数据值
                deviceId,
                serviceId,
                characteristicId: item.uuid,
              })
            }
            if (item.properties.write) {//向低功耗蓝牙设备特征值中写入二进制数据。注意：必须设备的特征值支持 write 才可以成功调用
              this.canWrite = true;
              this.deviceId = deviceId;
              this.serviceId = serviceId;
              this.characteristicId = item.uuid;
              this.writeBLECharacteristicValue();
            }
            if (item.properties.notify || item.properties.indicate) {
              uni.notifyBLECharacteristicValueChange({//启用低功耗蓝牙设备特征值变化时的 notify 功能，订阅特征值。注意：必须设备的特征值支持 notify 或者 indicate 才可以成功调用。
                deviceId,
                serviceId,
                characteristicId: item.uuid,
                state: true,
              })
            }
          }
        },
        fail(res) {
          console.error('getBLEDeviceCharacteristics', res)
        }
      })
      // 操作之前先监听，保证第一时间获取数据
      uni.onBLECharacteristicValueChange((characteristic) => {
        const idx = inArray(this.chs, 'uuid', characteristic.characteristicId)
        const data = {}
        if (idx === -1) {
          this.chs.push({
            uuid: characteristic.characteristicId,
            value: ab2hex(characteristic.value)
          });
        } else {
          this.chs[idx] = {
            uuid: characteristic.characteristicId,
            value: ab2hex(characteristic.value)
          }
        }
      })
    },
    writeBLECharacteristicValue() {//向低功耗蓝牙设备特征值中写入二进制数据。注意：必须设备的特征值支持 write 才可以成功调用
      // 向蓝牙设备发送一个0x00的16进制数据
      // let buffer =this.hexStringToArrayBuffer(“AAAA20201015555");
      let buffer = this.hexStringToArrayBuffer("AAAACC32014D************015555");
uni.writeBLECharacteristicValue({
          deviceId: this.deviceId,
          serviceId: this.serviceId,
          characteristicId: this.characteristicId,
          value: buffer,
          success: function (res) {
            console.log('writeBLECharacteristicValue success', res)
          },
          fail: function (err) {
            console.log(err, "errerrerrerrerr")
          }
        })
},
    closeBluetoothAdapter() {
      uni.closeBluetoothAdapter()
      this.discoveryStarted = false
    },
    //向蓝牙设备发送一个0x00的16进制数据
    hexStringToArrayBuffer(str) {
      if (!str) {
        return new ArrayBuffer(0);
      }
      var buffer = new ArrayBuffer(str.length);
      let dataView = new DataView(buffer)
      let ind = 0;
      for (var i = 0, len = str.length; i < len; i += 2) {
        let code = parseInt(str.substr(i, 2), 16)
        dataView.setUint8(ind, code)
        ind++
      }
      return buffer;
    }
  }
}
Page({

})
