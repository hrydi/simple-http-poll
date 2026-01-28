# HTTP Polling - Vanilla JavaScript

Script polling HTTP yang aman, efisien, dan mendukung multi-tab dengan automatic leader election.

## Features

✅ **Memory Safe** - Tidak ada memory leak, semua resources dibersihkan dengan proper

✅ **Multi-Tab Coordination** - Hanya 1 tab yang melakukan polling (leader), tab lain menerima data

✅ **State Synchronization** - Start/stop polling di satu tab akan sinkron ke semua tab otomatis

✅ **Automatic Leader Election** - Jika leader tab ditutup, tab lain otomatis mengambil alih

✅ **AbortController Support** - Request dapat di-abort dengan aman

✅ **Event-Based Callbacks** - Interface yang mudah digunakan dengan event listeners

✅ **No Framework Required** - Pure Vanilla JavaScript

✅ **Cross-Tab Communication** - Menggunakan BroadcastChannel + localStorage 
fallback

✅ **Configurable** - URL, interval, dan fetch options dapat dikonfigurasi


## Instalasi

### Cara 1: Include langsung di HTML

```html
<script src="assets/polling.js"></script>
<script>
  const poller = new HTTPPolling({
    url: 'https://api.example.com/data',
    interval: 5000
  });
</script>
```

### Cara 2: ES6 Module (jika diperlukan)

```javascript
import HTTPPolling from './assets/polling.js';

const poller = new HTTPPolling({
  url: 'https://api.example.com/data',
  interval: 5000
});
```

## Quick Start

### Basic Usage

```javascript
// 1. Buat instance
const poller = new HTTPPolling({
  url: 'https://jsonplaceholder.typicode.com/todos/1',
  interval: 5000  // Poll setiap 5 detik
});

// 2. Register callbacks
poller.onData((data) => {
  console.log('Received data:', data);
  // Update UI dengan data
});

poller.onError((error) => {
  console.error('Polling error:', error);
});

// 3. Start polling
poller.startPolling();

// 4. Stop saat tidak dibutuhkan
// poller.stopPolling();

// 5. Cleanup sepenuhnya
// poller.destroy();
```

## API Reference

### Constructor Options

```javascript
const poller = new HTTPPolling({
  // Required
  url: string,                    // Endpoint URL yang akan di-poll

  // Optional
  interval: number,               // Interval polling dalam ms (default: 5000)
  fetchOptions: object,           // Opsi untuk fetch API (headers, method, dll)
  leaderKey: string,              // localStorage key untuk leader info (default: 'polling_leader')
  dataKey: string,                // localStorage key untuk data cache (default: 'polling_data')
  heartbeatInterval: number,      // Interval heartbeat dalam ms (default: 2000)
  leaderTimeout: number           // Timeout sebelum leader dianggap mati (default: 5000)
});
```

### Methods

#### `startPolling()`
Mulai polling ke endpoint.

```javascript
poller.startPolling();
```

**Notes:**
- Jika tab adalah leader, akan segera mulai request
- Jika tab adalah follower, akan menunggu data dari leader
- Tidak akan membuat polling baru jika sudah ada yang berjalan

---

#### `stopPolling()`
Hentikan polling.

```javascript
poller.stopPolling();
```

**Notes:**
- Akan abort request yang sedang berjalan
- Tidak melepas event listeners (gunakan `destroy()` untuk itu)
- Masih bisa di-start kembali dengan `startPolling()`

---

#### `isLeader()`
Cek apakah tab ini adalah leader.

```javascript
if (poller.isLeader()) {
  console.log('This tab is the leader');
}
```

**Returns:** `boolean`

---

#### `onData(callback)`
Register callback untuk menerima data.

```javascript
const unsubscribe = poller.onData((data) => {
  console.log('Received:', data);
  document.getElementById('output').textContent = JSON.stringify(data);
});

// Unsubscribe jika tidak dibutuhkan
// unsubscribe();
```

**Parameters:**
- `callback: (data: any) => void` - Function yang dipanggil saat data diterima

**Returns:** `() => void` - Function untuk unsubscribe

**Notes:**
- Callback dipanggil di semua tab (leader dan follower)
- Data bisa berupa JSON object, string, atau tipe lainnya
- Multiple callbacks bisa didaftarkan

---

#### `onError(callback)`
Register callback untuk error handling.

```javascript
const unsubscribe = poller.onError((error) => {
  console.error('Polling error:', error.message);
  // Show error notification
});

// Unsubscribe
// unsubscribe();
```

**Parameters:**
- `callback: (error: Error) => void` - Function yang dipanggil saat terjadi error

**Returns:** `() => void` - Function untuk unsubscribe

**Notes:**
- Error dari network, timeout, atau abort akan memicu callback ini
- AbortError (dari stop/destroy) tidak akan memicu callback

---

#### `onLeaderChange(callback)`
Register callback untuk perubahan leadership.

```javascript
const unsubscribe = poller.onLeaderChange((isLeader) => {
  if (isLeader) {
    console.log('This tab became the leader');
  } else {
    console.log('This tab lost leadership');
  }
});

// Unsubscribe
// unsubscribe();
```

**Parameters:**
- `callback: (isLeader: boolean) => void` - Function yang dipanggil saat leadership berubah

**Returns:** `() => void` - Function untuk unsubscribe

---

#### `configure(options)`
Update konfigurasi polling saat runtime.

```javascript
poller.configure({
  url: 'https://api.example.com/new-endpoint',
  interval: 10000,  // Ubah interval menjadi 10 detik
  fetchOptions: {
    headers: {
      'Authorization': 'Bearer new-token'
    }
  }
});
```

**Parameters:**
- `options: object` - Konfigurasi baru (sama seperti constructor options)

**Notes:**
- Jika polling sedang berjalan dan interval diubah, polling akan di-restart
- URL dan fetchOptions akan digunakan pada request berikutnya

---

#### `getLastData()`
Ambil data terakhir dari localStorage cache.

```javascript
const lastData = poller.getLastData();
if (lastData) {
  console.log('Cached data:', lastData);
}
```

**Returns:** `any | null` - Data terakhir atau null jika tidak ada

**Notes:**
- Berguna untuk menampilkan data saat page pertama kali load
- Data di-cache oleh leader tab

---

#### `destroy()`
Cleanup instance secara menyeluruh.

```javascript
poller.destroy();
```

**Notes:**
- Stops polling
- Resigns dari leadership
- Removes semua event listeners
- Closes BroadcastChannel
- Clears semua callbacks
- Setelah destroy, instance tidak bisa digunakan lagi

## Advanced Usage

### Custom Headers & Authentication

```javascript
const poller = new HTTPPolling({
  url: 'https://api.example.com/protected',
  interval: 5000,
  fetchOptions: {
    method: 'GET',
    headers: {
      'Authorization': 'Bearer your-token-here',
      'Content-Type': 'application/json',
      'X-Custom-Header': 'value'
    },
    credentials: 'include'  // Include cookies
  }
});
```

### POST Request Polling

```javascript
const poller = new HTTPPolling({
  url: 'https://api.example.com/query',
  interval: 3000,
  fetchOptions: {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      query: 'status',
      filters: { active: true }
    })
  }
});
```

### Dynamic Configuration Update

```javascript
const poller = new HTTPPolling({
  url: 'https://api.example.com/data',
  interval: 5000
});

// Start polling
poller.startPolling();

// Update token setelah login
function onLogin(token) {
  poller.configure({
    fetchOptions: {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  });
}

// Ubah interval berdasarkan kondisi
function onSlowConnection() {
  poller.configure({
    interval: 10000  // Slow down polling
  });
}
```

### Multiple Polling Instances

```javascript
// Polling untuk notifications
const notificationPoller = new HTTPPolling({
  url: 'https://api.example.com/notifications',
  interval: 10000,
  leaderKey: 'notifications_leader',
  dataKey: 'notifications_data'
});

// Polling untuk user status
const statusPoller = new HTTPPolling({
  url: 'https://api.example.com/user/status',
  interval: 30000,
  leaderKey: 'status_leader',
  dataKey: 'status_data'
});

notificationPoller.onData(updateNotificationBadge);
statusPoller.onData(updateUserStatus);

notificationPoller.startPolling();
statusPoller.startPolling();
```

**Important:** Gunakan `leaderKey` dan `dataKey` yang berbeda untuk setiap instance!

### Listening for State Changes (UI Synchronization)

Untuk menyinkronkan UI dengan perubahan state dari tab lain, gunakan BroadcastChannel atau localStorage event:

```javascript
const poller = new HTTPPolling({
  url: 'https://api.example.com/data',
  interval: 5000
});

// Function untuk update UI
function updateUI(isPolling) {
  const statusEl = document.getElementById('status');
  const startBtn = document.getElementById('start-btn');
  const stopBtn = document.getElementById('stop-btn');

  if (isPolling) {
    statusEl.textContent = 'Active';
    startBtn.disabled = true;
    stopBtn.disabled = false;
  } else {
    statusEl.textContent = 'Stopped';
    startBtn.disabled = false;
    stopBtn.disabled = true;
  }
}

// Set initial UI
updateUI(poller.isPolling);

// Listen via BroadcastChannel
if (typeof BroadcastChannel !== 'undefined') {
  const channel = new BroadcastChannel('http_polling_channel');
  channel.onmessage = (event) => {
    const msg = event.data;
    if (msg.tabId === poller.tabId) return; // Skip own messages

    if (msg.type === 'start_polling') {
      updateUI(true);
    } else if (msg.type === 'stop_polling') {
      updateUI(false);
    }
  };
}

// Listen via localStorage (fallback)
window.addEventListener('storage', (event) => {
  if (event.key === poller.stateKey && event.newValue) {
    const state = JSON.parse(event.newValue);
    updateUI(state.isPolling);
  }
});

// Button handlers
document.getElementById('start-btn').onclick = () => {
  poller.startPolling();
  updateUI(true);
};

document.getElementById('stop-btn').onclick = () => {
  poller.stopPolling();
  updateUI(false);
};
```

### React Integration Example

```javascript
import { useEffect, useState } from 'react';
import HTTPPolling from './assets/polling.js';

function usePolling(url, interval = 5000) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [isLeader, setIsLeader] = useState(false);

  useEffect(() => {
    const poller = new HTTPPolling({ url, interval });

    const unsubscribeData = poller.onData(setData);
    const unsubscribeError = poller.onError(setError);
    const unsubscribeLeader = poller.onLeaderChange(setIsLeader);

    poller.startPolling();

    // Cleanup on unmount
    return () => {
      poller.destroy();
      unsubscribeData();
      unsubscribeError();
      unsubscribeLeader();
    };
  }, [url, interval]);

  return { data, error, isLeader };
}

// Usage
function MyComponent() {
  const { data, error, isLeader } = usePolling(
    'https://api.example.com/data',
    5000
  );

  if (error) return <div>Error: {error.message}</div>;
  if (!data) return <div>Loading...</div>;

  return (
    <div>
      {isLeader && <span>🔴 Leader Tab</span>}
      <pre>{JSON.stringify(data, null, 2)}</pre>
    </div>
  );
}
```

### Vue Integration Example

```javascript
import { ref, onMounted, onUnmounted } from 'vue';
import HTTPPolling from './assets/polling.js';

export function usePolling(url, interval = 5000) {
  const data = ref(null);
  const error = ref(null);
  const isLeader = ref(false);

  let poller = null;
  const unsubscribers = [];

  onMounted(() => {
    poller = new HTTPPolling({ url, interval });

    unsubscribers.push(poller.onData((d) => (data.value = d)));
    unsubscribers.push(poller.onError((e) => (error.value = e)));
    unsubscribers.push(poller.onLeaderChange((l) => (isLeader.value = l)));

    poller.startPolling();
  });

  onUnmounted(() => {
    unsubscribers.forEach((unsub) => unsub());
    if (poller) poller.destroy();
  });

  return { data, error, isLeader };
}
```

## Multi-Tab Behavior

### Bagaimana Multi-Tab Bekerja?

1. **Leader Election**
   - Saat page dibuka, tab akan mencoba menjadi leader
   - Menggunakan localStorage untuk koordinasi antar tab
   - Leader mengirim heartbeat setiap 2 detik (default)

2. **Polling Execution**
   - Hanya leader yang melakukan HTTP request
   - Leader broadcast data ke semua tab via BroadcastChannel
   - Fallback ke localStorage jika BroadcastChannel tidak tersedia

3. **Leader Failover**
   - Follower tabs memonitor leader heartbeat
   - Jika leader tidak heartbeat dalam 5 detik (default), dianggap mati
   - Tab lain otomatis promote diri menjadi leader baru

4. **Data Synchronization**
   - Semua tab menerima data yang sama
   - Data di-cache di localStorage untuk persistence
   - Tab baru bisa load cached data via `getLastData()`

5. **State Synchronization**
   - `startPolling()` di satu tab → semua tab otomatis mulai polling
   - `stopPolling()` di satu tab → semua tab otomatis berhenti
   - State polling disimpan di localStorage
   - Tab baru yang dibuka akan otomatis sync dengan state yang sedang berjalan

### Testing Multi-Tab

1. Buka `polling-example.html` di browser
2. Start polling di Tab 1
3. Buka tab baru (Tab 2) dengan URL yang sama
4. Perhatikan:
   - Hanya satu tab menunjukkan status "Leader"
   - Tab lain menunjukkan "Follower"
   - **Semua tab menunjukkan status "Active"** (state tersinkronisasi)
   - Semua tab menerima data yang sama
5. Stop polling di Tab 2
6. Perhatikan: **Semua tab (termasuk Tab 1) otomatis berhenti**
7. Start polling lagi di tab mana saja
8. Perhatikan: **Semua tab kembali Active**
9. Buka Tab 3 baru saat polling sedang berjalan
10. Perhatikan: **Tab 3 langsung menunjukkan status "Active"** dan jika menjadi leader, otomatis polling
11. Tutup leader tab
12. Tab lain akan otomatis menjadi leader dan melanjutkan polling

## Memory Safety

Script ini dirancang untuk mencegah memory leak:

### Automatic Cleanup
- ✅ Semua intervals di-clear saat `destroy()`
- ✅ Timeouts di-clear saat polling stop
- ✅ Event listeners di-remove
- ✅ BroadcastChannel di-close
- ✅ AbortController abort pending requests

### Best Practices

```javascript
// BAD: Tidak cleanup
const poller = new HTTPPolling({ url: '/api/data' });
poller.startPolling();
// Page unload tanpa cleanup = memory leak!

// GOOD: Cleanup saat unload
const poller = new HTTPPolling({ url: '/api/data' });
poller.startPolling();

window.addEventListener('beforeunload', () => {
  poller.destroy();
});

// BETTER: Automatic cleanup di framework
// React
useEffect(() => {
  const poller = new HTTPPolling({ url: '/api/data' });
  poller.startPolling();
  return () => poller.destroy();  // Cleanup on unmount
}, []);

// Vue
onUnmounted(() => {
  poller.destroy();
});
```

## Browser Support

### Required Features
- ✅ `fetch` API
- ✅ `AbortController`
- ✅ `localStorage`
- ✅ `addEventListener` / `removeEventListener`

### Optional Features
- 🟡 `BroadcastChannel` (fallback: localStorage events)
- 🟡 `visibilitychange` event (graceful degradation)

### Tested Browsers
- ✅ Chrome 90+
- ✅ Firefox 85+
- ✅ Safari 14+
- ✅ Edge 90+

## Troubleshooting

### Polling tidak berjalan di tab manapun

**Penyebab:**
- URL tidak valid
- CORS error
- Network error

**Solusi:**
```javascript
poller.onError((error) => {
  console.error('Error details:', error);
  // Check network tab di DevTools
});
```

### Multiple tabs melakukan polling (seharusnya hanya 1)

**Penyebab:**
- localStorage diblok oleh browser settings
- BroadcastChannel dan localStorage tidak tersedia
- Bug di browser (sangat jarang)

**Solusi:**
- Check browser console untuk error
- Pastikan localStorage enabled
- Test di browser lain

### Data tidak sinkron antar tab

**Penyebab:**
- BroadcastChannel tidak didukung
- localStorage event tidak fire
- Tab dari domain berbeda (cross-origin)

**Solusi:**
- Pastikan semua tab dari origin yang sama
- Check DevTools untuk BroadcastChannel support
- Coba refresh semua tabs

### Memory leak setelah banyak page navigations

**Penyebab:**
- `destroy()` tidak dipanggil
- Event listeners tidak di-cleanup

**Solusi:**
```javascript
// Pastikan cleanup di beforeunload
window.addEventListener('beforeunload', () => {
  if (poller) {
    poller.destroy();
  }
});

// Atau gunakan di framework lifecycle
// React: useEffect cleanup
// Vue: onUnmounted
```

## Performance Tips

### 1. Adjust Interval Based on Activity

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    // Slow down when tab is hidden
    poller.configure({ interval: 30000 });
  } else {
    // Speed up when tab is visible
    poller.configure({ interval: 5000 });
  }
});
```

### 2. Use Appropriate Intervals

```javascript
// Fast: Real-time updates (setiap 1-3 detik)
const realtimePoller = new HTTPPolling({
  url: '/api/notifications',
  interval: 2000
});

// Medium: Regular updates (setiap 5-10 detik)
const regularPoller = new HTTPPolling({
  url: '/api/status',
  interval: 5000
});

// Slow: Infrequent updates (setiap 30-60 detik)
const slowPoller = new HTTPPolling({
  url: '/api/stats',
  interval: 30000
});
```

### 3. Implement Exponential Backoff on Errors

```javascript
let errorCount = 0;
const baseInterval = 5000;
const maxInterval = 60000;

poller.onError((error) => {
  errorCount++;
  const newInterval = Math.min(
    baseInterval * Math.pow(2, errorCount),
    maxInterval
  );

  console.log(`Error #${errorCount}, backing off to ${newInterval}ms`);
  poller.configure({ interval: newInterval });
});

poller.onData((data) => {
  // Reset on success
  if (errorCount > 0) {
    errorCount = 0;
    poller.configure({ interval: baseInterval });
  }
});
```

## Security Considerations

### 1. Validate Response Data

```javascript
poller.onData((data) => {
  // Validate before using
  if (!data || typeof data !== 'object') {
    console.warn('Invalid data received');
    return;
  }

  // Sanitize if displaying in HTML
  const sanitized = DOMPurify.sanitize(data.html);
  element.innerHTML = sanitized;
});
```

### 2. Secure Credentials

```javascript
// BAD: Hardcoded token
const poller = new HTTPPolling({
  url: '/api/data',
  fetchOptions: {
    headers: {
      'Authorization': 'Bearer hardcoded-token-123'  // ❌
    }
  }
});

// GOOD: Get from secure storage
async function createSecurePoller() {
  const token = await getTokenFromSecureStorage();

  const poller = new HTTPPolling({
    url: '/api/data',
    fetchOptions: {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    }
  });

  return poller;
}
```

### 3. Rate Limiting

```javascript
// Implement client-side rate limiting
const MIN_INTERVAL = 1000;  // Don't poll faster than 1 second

const poller = new HTTPPolling({
  url: '/api/data',
  interval: Math.max(userInterval, MIN_INTERVAL)
});
```

## License

MIT License - Silakan gunakan untuk project komersial maupun non-komersial.

## Support

Untuk bug reports atau feature requests, silakan buat issue di repository project.

---

**Created with ❤️ using Vanilla JavaScript**
