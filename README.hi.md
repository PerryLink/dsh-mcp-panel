# dsh-mcp-panel

**DeepSeek Harness के आधिकारिक MCP क्लाइंट के लिए रीड-ओनली रनटाइम प्रबंधन पैनल — हर MCP सर्वर का स्टेटस, टूल, एरर और रीकनेक्ट काउंट देखें, बिना अपनी कॉन्फ़िगरेशन छुए।**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![CI](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)
[![deepseek-harness](https://img.shields.io/badge/runtime-deepseek--harness-4f46e5)](https://github.com/deepseek-ai/deepseek-harness)

> 🔭 **ऑब्ज़र्वेबिलिटी सबसे पहले।** [`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) अपना कनेक्शन स्टेट निजी रखता है — सिर्फ़ लॉग। यह प्लगइन वह सब दिखाता है जो *देखा जा सकता है* (कॉन्फ़िगरेशन, टूल रजिस्ट्री, Loader स्टेट) और जो नहीं देखा जा सकता उसके लिए अनुमान लगाने की बजाय साफ़-साफ़ **"unknown"** कहता है। यह वह न्यूनतम अपस्ट्रीम सीम भी प्रस्तावित करता है जिससे स्टेटस वास्तविक बनेगा: देखें [upstream proposal](docs/upstream-proposal.md)।

## संगतता

- **रनटाइम**: DeepSeek Harness ≥ `0.1.0-rc.5` (peerDependencies `0.1.0-rc.6` पैकेज लाइन पिन करती हैं)।
- **नवीनतम संस्करण**: v0.3.0 (2026-08-15) — TypeScript 7 / Vitest 4 / jsdom 30 टूलचेन पर पूरा द्वार हरा, 109 टेस्ट।
- **अंतिम सत्यापन**: 2026-08-14, deepseek-harness के सोर्स checkout के विरुद्ध (workspace पैकेज `0.1.0-rc.5`, mainline `7b9644f`) — headless `/mcp` एंड-टू-एंड + लाइव वेब प्रोफ़ाइल; प्रमाण [docs/research-notes.zh.md](docs/research-notes.zh.md) में। उसी दिन mainline `47f9438` + `mcp/status` सीम ब्रांच (`feat/mcp-client-status-observability-seam`) के विरुद्ध पुनः सत्यापित: असली `server-everything` पंक्ति पैक किए गए प्लगइन से `status: connected (source: upstream-event)` दिखाती है, साथ ही लॉन्चर-समतुल्य संगतता प्रवाह; रिकॉर्ड [docs/optimization-plan-v2.zh.md](docs/optimization-plan-v2.zh.md) में।

## आपको क्या मिलता है

| सतह | क्या दिखाती है |
|---|---|
| **`/mcp` कमांड** | ट्रांसपोर्ट, टार्गेट, टूल काउंट, कनेक्शन स्टेटस, अंतिम एरर, रीकनेक्ट काउंट — मॉडल-रीडेबल और लॉग से रीकंस्ट्रक्टेबल, पाँच आउटपुट भाषाएँ (`outputLanguage: en\|zh\|es\|pt\|hi`) |
| **सेटिंग्स → प्लगइन्स → MCP टैब** | वही स्नैपशॉट रीड-ओनली: स्टेटस बैज, विस्तार योग्य टूल सूचियाँ, सैनिटाइज़्ड एरर, प्रोब परिणाम |
| **एक नज़र में** | कार्ड के ऊपर सारांश गिनती, सर्वर खोज बॉक्स, और सभी विस्तार/संकुचन बटन |
| **पैनल प्रोब बटन** | टैब से एक streamable-http सर्वर की एक-क्लिक कनेक्टिविटी प्रोब; परिणाम केवल पैनल में रहते हैं |
| **पैसिव प्रोब** | प्रति सर्वर वैकल्पिक बैकग्राउंड रीचेबिलिटी बैज, कनेक्शन स्टेटस से अलग |
| **ऑटो रिफ्रेश** | होस्ट एक रिफ्रेश अंतराल सुझाता है (`refreshIntervalMs`); टैब पोल करता है और छिपा होने पर रुक जाता है |
| **`/mcp <server> disable\|enable`** | लागू करने के लिए सटीक `cordis.patch.yml` लाइन — एक *सुझाव*, कभी लिखावट नहीं |
| **`mcp_probe` टूल** | Streamable HTTP एंडपॉइंट की एक-बार कनेक्टिविटी प्रोब (बैकग्राउंड जॉब); परिणाम **केवल पैनल में** |

## त्वरित शुरुआत

```sh
# git चैनल (पैकेज के prepare स्क्रिप्ट से बिल्ड होता है)
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.3.0
# npm चैनल (प्रकाशित tarball, बिल्ड अनुमोदन की आवश्यकता नहीं)
dsh plugin --profile web add dsh-mcp-panel@0.3.0
```

फिर रीस्टार्ट करें (या वेब सतह को अपनी `cordis.patch.yml` हॉट-रीलोड करने दें) और चलाएँ:

```text
/mcp
/mcp everything tools
/mcp everything disable
```

```text
MCP servers (1):
- everything [mcp-everything] stdio node …/server-everything/dist/index.js
  | 13 tools | enabled | status: unknown (source: derived) | reconnects: — | last error: —
```

मैन्युअल इंस्टॉल: `dsh-mcp-panel` को प्रोफ़ाइल के `node_modules` (या साझा
`$DSH_HOME/profiles/node_modules` फ़ॉलबैक) में रखें और `cordis.patch.yml` में यह लाइन जोड़ें:

```yaml
- insert:
    - id: mcp-panel
      name: dsh-mcp-panel
      config:
        probeEnabled: true
        probeTimeoutMs: 10000
```

### अनइंस्टॉल

1. `cordis.patch.yml` से `mcp-panel` लाइन हटाएँ (वेब सतह इसे हॉट-रीलोड करती है; अन्य सतहें रीस्टार्ट करें)।
2. प्रोफ़ाइल के `node_modules` (या साझा `profiles/node_modules` फ़ॉलबैक) से पैकेज हटाएँ।
3. `dsh web --dump-config` से पुष्टि करें कि कोई `mcp-panel` लाइन नहीं बची।

## अनुबंध द्वारा ईमानदारी

- **रीड-ओनली।** कोई कॉन्फ़िगरेशन फ़ाइल कभी नहीं लिखी जाती। `disable`/`enable` एक सुझाव छापता है जिसे आप स्वयं लागू करते हैं।
- **नकली स्टेटस नहीं।** अपस्ट्रीम डेटा के बिना कनेक्शन फ़ील्ड `unknown` / `—` दिखाते हैं, साथ में `statusSource: derived`।
- **सैनिटाइज़्ड प्रदर्शन।** URL क्वेरी क्रेडेंशियल, userinfo पासवर्ड, हेडर मान, बियरर टोकन और JWT रेंडरिंग से पहले हटा दिए जाते हैं; कॉन्फ़िगर किए गए `headers` किसी भी स्नैपशॉट में नहीं जाते।
- **केवल-पैनल परिणाम।** प्रोब विवरण सेटिंग्स टैब में रहते हैं, मॉडल संदर्भ में कभी नहीं; `/mcp` आउटपुट मॉडल-रीडेबल सतह है और सेशन लॉग से पूरी तरह रीकंस्ट्रक्टेबल है।
- **mcp-client में कोई बदलाव नहीं।** ट्रांसपोर्ट, OAuth और प्रोटोकॉल अछूते रहते हैं — ऑब्ज़र्वेबिलिटी का अंतर [upstream proposal](docs/upstream-proposal.md) से ढका जाता है, जिसे यह प्लगइन पहले से उपभोग करता है (टाइप्ड `mcp/status` इवेंट + `mcpStatus` क्वेरी सेवा, रनटाइम फ़ीचर-डिटेक्शन)।

## कॉन्फ़िगरेशन

| फ़ील्ड | डिफ़ॉल्ट | विवरण |
|---|---|---|
| `probeEnabled` | `true` | `mcp_probe` टूल पंजीकृत करें (रचना में `ctx.jobs` चाहिए) |
| `probeTimeoutMs` | `10000` | प्रति प्रोब समय-सीमा |
| `maxProbes` | `10` | पैनल में दिखाए जाने वाले प्रोब रिकॉर्ड की सीमा |
| `refreshIntervalMs` | `0` | पैनल के लिए सुझाया गया रिफ्रेश अंतराल (ms; `0` = केवल मांग पर) |
| `outputLanguage` | `en` | `/mcp` कमांड की आउटपुट भाषा (`en` \| `zh` \| `es` \| `pt` \| `hi`) |
| `passiveProbeEnabled` | `false` | streamable-http सर्वरों की बैकग्राउंड में आवधिक प्रोब |
| `passiveProbeIntervalMs` | `60000` | पैसिव प्रोब अंतराल (मिलीसेकंड) |

## अनुमतियाँ और डेटा

- **पढ़ता है**: Loader पंक्तियाँ, टूल रजिस्ट्री (`mcp__<server>__` नाम), और upstream लागू होने पर `mcp/status` इवेंट।
- **लिखता है**: कुछ नहीं। कोई कॉन्फ़िगरेशन फ़ाइल कभी संशोधित नहीं होती।
- **नेटवर्क**: केवल एक-बार `mcp_probe` (और वैकल्पिक पैसिव प्रोब) आपके कॉन्फ़िगर किए एंडपॉइंट्स पर एक MCP `initialize` अनुरोध भेजती है; कॉन्फ़िगर किए हेडर केवल अनुरोध के लिए उपयोग होते हैं और कभी प्रदर्शित या लॉग नहीं होते।
- कोई टेलीमेट्री नहीं, कोई बाहरी सेवा नहीं, वैकल्पिक प्रोब टाइमर के अलावा कोई बैकग्राउंड कार्य नहीं।

## समस्या निवारण

- लाइन दिखाई नहीं दे रही? `dsh web --dump-config` चलाएँ और जाँचें कि `mcp-panel` insert अद्वितीय id के साथ लागू हुआ।
- पैनल `status: unknown (source: derived)` दिखाता है — upstream सीम आने तक अपेक्षित; देखें [docs/upstream-proposal.md](docs/upstream-proposal.md)।
- पैनल पुराना लग रहा है? `mcp-panel` कॉन्फ़िग लाइन में `refreshIntervalMs` को सकारात्मक मान (जैसे `5000`) पर सेट करें ताकि स्वतः पोल हो।
- बूट लॉग में FAILED `mcp-panel` fiber — पैकेज को प्रोफ़ाइल से रिज़ॉल्व होना चाहिए (बेयर `name: dsh-mcp-panel` प्रोफ़ाइल के `node_modules` या साझा फ़ॉलबैक से रिज़ॉल्व होता है)।
- रोलबैक: लाइन हटाएँ (अनइंस्टॉल देखें)।

## सुरक्षा

सुरक्षा समस्या मिली? GitHub issue खोलें **बिना** सीक्रेट, की या टोकन चिपकाए — पहले सब रिडैक्ट करें। यह प्लगइन आपके कॉन्फ़िगर किए MCP सर्वरों की क्रेडेंशियल केवल प्रोब अनुरोधों के लिए मेमोरी में रखता है; वे कभी लॉग या स्नैपशॉट तक नहीं पहुँचते।

## यह कैसे काम करता है

- **होस्ट आधा** — एक `mcpPanel` Typert Remote सेवा तीन रीड-ओनली स्रोतों से स्नैपशॉट बनाती है: Loader पंक्तियाँ (`@deepseek-ai/dsh-mcp-client` एंट्री), `mcp__<server>__` नेमस्पेस से समूहित `ctx.tools.schemas()`, और अपस्ट्रीम `mcp/status` ऑब्ज़र्वेशन। हाथ से लिखा `./typert` मैनिफ़ेस्ट `mcpPanel/status` को गेटवे में पंजीकृत करता है; `zod` बंडल में शामिल है, इसलिए होस्ट आधा स्व-निहित है।
- **ब्राउज़र आधा** — एक `dsh.client` बंडल (`/plugins/dsh-mcp-panel/client.js` पर सर्व किया गया) उसी डिस्क्रिप्टर को `ctx.remote.$mount` से माउंट करता है और रीड-ओनली `settings.plugins.tab` एंट्री (`id: mcp`) पंजीकृत करता है। प्रेज़ेंटर एक शुद्ध फ़ंक्शन है; स्टाइल स्कोप्ड हैं और थीम टोकन का उपयोग करते हैं।
- **`/mcp` कमांड** मानक कमांड रजिस्ट्री से गुज़रता है — हर पंक्ति `command/run` + `command/done` सेशन इवेंट में दर्ज होती है।

## विकास

```sh
pnpm install
pnpm run typecheck    # स्थानीय द्वार: tsconfig पथों से harness checkout के ताज़ा टाइप फेस
pnpm run typecheck:ci # npm द्वार: प्रकाशित 0.1.0-rc.6 टाइप फेस (जो CI चलाता है)
pnpm test             # 109 टेस्ट: सैनिटाइज़र चरम मामले, समूहन, एग्रीगेशन सहनशीलता, कमांड आउटपुट (5 भाषाएँ), प्रोब गेटिंग, क्लाइंट वायरिंग, प्रेज़ेंटर (बैज/सारांश/फ़िल्टर)
pnpm run build        # tsc डिक्लेरेशन → lib/types; tsdown → lib/index.js + lib/typert.host.js + lib/client.js
pnpm run verify:self-contained
pnpm run verify:artifacts
pnpm pack
```

रिलीज़: `node scripts/release.mjs <x.y.z>` संस्करण बढ़ाता है, CHANGELOG पर मुहर लगाता है, द्वार फिर चलाता है, कमिट और टैग करता है; टैग पुश करने पर npm और GitHub Release अपने आप प्रकाशित होते हैं (देखें [CONTRIBUTING.md](CONTRIBUTING.md))।

असली harness checkout के विरुद्ध सत्यापन:
`node --import tsx/esm scripts/verify-headless.mjs` पूरे वेब प्रोफ़ाइल को प्रोसेस में बूट करता है (क्षणिक पोर्ट) और `/mcp`, `/mcp <server> tools`, `/mcp <server> disable` का सटीक आउटपुट छापता है।

## लाइसेंस

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel योगदानकर्ता
