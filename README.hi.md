<div align="center">

# dsh-mcp-panel

**DeepSeek Harness के आधिकारिक MCP क्लाइंट के लिए MCP प्रबंधन कंसोल — सेटिंग्स पेज से MCP सर्वर जोड़ें, बदलें, हटाएँ और टूल आज़माएँ; ईमानदार स्थिति, स्वास्थ्य निदान और सुरक्षित, वापस लाने योग्य प्रोफ़ाइल लेखन के साथ।**

*आधिकारिक क्लाइंट = पुल, यह प्लगइन = कंसोल: `mcp/status` seam से स्थिति पढ़ें, केवल जोड़ने वाले, अनुमोदित प्रोफ़ाइल patch लिखें।*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![DSH plugin](https://img.shields.io/badge/dsh-plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-mcp-panel/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-mcp-panel/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-mcp-panel?label=version)](https://github.com/PerryLink/dsh-mcp-panel/releases)
[![npm version](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![npm downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

</div>

---

## Compatibility

| सतह | स्थिति |
|---|---|
| Harness | DeepSeek Harness `0.1.1-rc.2`–`0.2.0` |
| Node | `^22.19.0 \|\| >=24.0.0` |
| प्लेटफ़ॉर्म | Web GUI (दोहरा चेहरा: host + browser) |
| मॉडल | कोई भी (पैनल रीड-ओनली है; केवल `/mcp` आउटपुट मॉडल-पठनीय है) |

## What you get

`dsh-mcp-panel` आधिकारिक MCP क्लाइंट के ऊपर की अनुभव परत है: एक रीड-ओनली रनटाइम दृश्य और सुरक्षित, वापस लाने योग्य प्रोफ़ाइल लेखन।

- **`/mcp` कमांड** — प्रति सर्वर एक पंक्ति: ट्रांसपोर्ट, लक्ष्य, टूल गिनती, कनेक्शन स्थिति (upstream seam से; अप्रेक्षित होने पर `unknown`), अंतिम त्रुटि, रीकनेक्ट — मॉडल-पठनीय, सत्र लॉग से पुनर्निर्माण योग्य, पाँच आउटपुट भाषाएँ।
- **`/mcp <server> tools`** — मॉडल-दृश्य `mcp__*` टूल नाम व विवरण।
- **`/mcp <server> health`** — व्युत्पन्न स्व-उपचार सुझाव (ENOENT → अनुपलब्ध निर्भरता, ECONNREFUSED, टाइमआउट, 401/403/404, DNS, दर सीमा, रीकनेक्ट समाप्त…); एग्ज़िट कोड / stderr पूँछ ईमानदारी से *upstream समर्थन की प्रतीक्षा में* चिह्नित।
- **`/mcp <server> call <tool> [json]`** — **आधिकारिक टूल पाइपलाइन** (`ctx.tools.execute()`) से परीक्षण कॉल; प्री-एग्ज़ीक्यूट अनुमति नीति, अनुमोदन, guards और post-execute सब लागू।
- **सेटिंग्स → प्लगइन्स → MCP टैब** — बैज, निदान और प्रोब वाले स्थिति कार्ड, साथ में सर्वर CRUD और टूल ट्रायल कंसोल।
- **सर्वर CRUD** — जोड़/बदल/हटा फ़ॉर्म → `insert`/`set`/`set disabled` अंश → क्लिपबोर्ड कॉपी या अनुमोदित लेखन, स्वचालित बैकअप के साथ।
- **टूल ट्रायल कंसोल** — सर्वर → `mcp__*` टूल → JSON तर्क → कैनोनिकल JSON परिणाम + रेंडर सामग्री; `trialMaxResultChars` से सीमित; केवल पैनल, मॉडल संदर्भ में कभी नहीं।

## Architecture: official client = bridge, this plugin = console

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) **एकमात्र पुल** है: प्रति MCP सर्वर एक इंस्टेंस, हाथ से लिखी `cordis.yml` पंक्ति के रूप में, जो ट्रांसपोर्ट जोड़ता है, टूल सिंक करता है और `mcp__<server>__<tool>` नाम पंजीकृत करता है। यह प्लगइन उसे कभी नहीं बदलता: यह उसके ऊपर की **अनुभव परत** है:

```text
                    ┌────────────────────────────────────────────┐
 profile            │  cordis.yml / cordis.patch.yml             │
 संरचना             │   - id: mcp-github                          │
 (प्रति सर्वर       │     name: '@deepseek-ai/dsh-mcp-client'     │
  एक पंक्ति,        │     config: { serverName, transport, … }    │
  हाथ से)           │   - id: mcp-panel                           │
                    │     name: dsh-mcp-panel   ◄── यह प्लगइन     │
                    └───────────────┬────────────────────────────┘
                                    │
        ┌───────────────────────────┴───────────────────────────┐
        │                                                        │
   ┌────▼──────────────┐        ┌───────────────────────────┐    │
   │ @deepseek-ai/dsh- │        │ dsh-mcp-panel (कंसोल)     │    │
   │ mcp-client        │        │                           │    │
   │ • ट्रांसपोर्ट     │        │ • /mcp कमांड              │    │
   │ • टूल सिंक        │        │ • सेटिंग्स → प्लगइन्स →   │    │
   │ • mcp__* टूल      │◄──────►│   MCP: CRUD, ट्रायल       │    │
   │ • mcp/status seam │ स्थिति │ • स्वास्थ्य निदान         │    │
   └───────────────────┘        │ • प्रोब, क्षमताएँ         │    │
                                └───────────────────────────┘    │
```

कंसोल क्लाइंट को उसके `mcp/status` अवलोकन seam (इवेंट + `mcpStatus` क्वेरी सेवा), टूल रजिस्ट्री और loader से **पढ़ता** है; **लिखता** केवल प्रोफ़ाइल की patch परत में — केवल-जोड़ने वाला, अनुमोदित, हमेशा बैकअप सहित। ट्रांसपोर्ट, OAuth और प्रोटोकॉल अछूते रहते हैं।

## Console vs. hand-written cordis.yml

| | हाथ से लिखा cordis.yml | dsh-mcp-panel कंसोल |
|---|---|---|
| सर्वर जोड़ें | YAML संपादित करें, इंडेंट/कोट्स का ध्यान | फ़ॉर्म → patch अंश → **कॉपी** या **लिखें** (अनुमोदन + बैकअप) |
| सर्वर बदलें | YAML संपादित करें, रीस्टार्ट/हॉट-रीलोड | लाइव पंक्ति से पहले से भरा फ़ॉर्म; बिना बदले सीक्रेट host पर ही रहते हैं |
| सर्वर हटाएँ | पंक्ति मिटाएँ | `set disabled: true` ऑपरेशन (patch शब्दावली में remove नहीं) — कभी भी फिर से सक्षम करने योग्य |
| स्थिति देखें | लॉग पढ़ें | बैज + रीकनेक्ट + अंतिम त्रुटि, `mcp/status` से लाइव |
| टूल आज़माएँ | मॉडल से कहें | ट्रायल कंसोल → आधिकारिक `ctx.tools.execute()` पाइपलाइन (अनुमतियाँ और अनुमोदन लागू) |
| विफलताओं का निदान | लॉग grep करें | `/mcp <server> health` व्युत्पन्न सुझावों के साथ |
| गलतियाँ | हाथ से वापस लाएँ | हर लेखन केवल-जोड़ने वाला है और समय-चिह्नित बैकअप छोड़ता है |

कंसोल का आउटपुट ही `cordis.patch.yml` शब्दावली है — वही पंक्तियाँ जो आप हाथ से लिखते, अब जनरेट, पूर्वावलोकित और सुरक्षित रूप से लागू।

## Quick start

```sh
# 1. bundle को अपने profile में इंस्टॉल करें
dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"

# या npm से (प्रकाशित संस्करण)
dsh plugin --profile web add dsh-mcp-panel

# 2. रीस्टार्ट करें और पंक्ति की पुष्टि करें
dsh --profile web --dump-config | grep -A3 'id: mcp-panel'
```

फिर **सेटिंग्स → प्लगइन्स → MCP** खोलें, या चलाएँ:

```text
/mcp
/mcp everything tools
/mcp everything health
/mcp everything call echo '{"message": "hi"}'
```

## Install & uninstall

- **git चैनल** (नवीनतम `main`): `dsh plugin --profile web add "github:PerryLink/dsh-mcp-panel#main"` — `prepare` स्क्रिप्ट केवल production निर्भरताओं से बिल्ड करती है।
- **npm चैनल** (प्रकाशित संस्करण): `dsh plugin --profile web add dsh-mcp-panel`।
- **tarball चैनल**: इस repo में `pnpm pack`, फिर `dsh plugin --profile web add ./dsh-mcp-panel-<version>.tgz`।
- **अनइंस्टॉल**: `cordis.patch.yml` से `mcp-panel` पंक्ति हटाएँ (वेब सतह इसे हॉट-रीलोड करती है), profile के `node_modules` से पैकेज हटाएँ, और `dsh web --dump-config` से पुष्टि करें कि कोई `mcp-panel` पंक्ति शेष नहीं है।

## Configuration

सभी ट्यूनेबल Schemastery `Config` फ़ील्ड हैं (cordis.yml से बदले जा सकते हैं)। `cordis.patch.yml` हर कुंजी को इनलाइन दस्तावेज़ित करता है।

| कुंजी | डिफ़ॉल्ट | अर्थ |
|---|---|---|
| `probeEnabled` | `true` | `mcp_probe` पृष्ठभूमि-कार्य टूल पंजीकृत करें (परिणाम केवल पैनल) |
| `probeTimeoutMs` | `10000` | प्रति-प्रोब timeout (ms) |
| `maxProbes` | `10` | पैनल में दिखाए गए प्रोब रिकॉर्ड |
| `refreshIntervalMs` | `0` | सुझाया गया पैनल रीफ़्रेश (ms); `0` = माँग पर |
| `outputLanguage` | `en` | `/mcp` आउटपुट भाषा: `en \| zh \| es \| pt \| hi` |
| `passiveProbeEnabled` | `false` | streamable-http सर्वरों की आवधिक जाँच |
| `passiveProbeIntervalMs` | `60000` | निष्क्रिय प्रोब अंतराल (ms) |
| `trialEnabled` | `true` | टूल ट्रायल कंसोल (सेटिंग्स टैब + `/mcp call`) |
| `trialTimeoutMs` | `120000` | प्रति ट्रायल कॉल पैनल-साइड समय सीमा (ms) |
| `trialMaxResultChars` | `60000` | ट्रायल परिणाम payload की सीमा (वर्ण) |
| `writeEnabled` | `true` | कठोर स्विच: `false` हर प्रोफ़ाइल लेखन अस्वीकार करता है (कॉपी फिर भी चलती है) |
| `backupCount` | `5` | प्रति लेखन रखे गए `cordis.patch.yml` बैकअप |

## Tools & surfaces

| सतह | प्रकार | टिप्पणियाँ |
|---|---|---|
| `/mcp` | command | प्रति-सर्वर स्थिति पंक्ति; मॉडल-पठनीय और लॉग-पुनर्निर्माण योग्य |
| `/mcp <server> tools` | command | मॉडल-दृश्य `mcp__*` टूल नाम + विवरण |
| `/mcp <server> health` | command | सैनिटाइज़्ड त्रुटि पाठ से व्युत्पन्न स्व-उपचार सुझाव |
| `/mcp <server> call <tool> [json]` | command | आधिकारिक टूल पाइपलाइन से परीक्षण कॉल |
| `mcp_probe` | tool | वैकल्पिक Streamable HTTP कनेक्टिविटी प्रोब (पृष्ठभूमि कार्य) |
| सेटिंग्स → प्लगइन्स → MCP टैब | UI slot | स्थिति कार्ड, सर्वर CRUD और टूल ट्रायल कंसोल |
| `mcpPanel` Typert Remote | service | रीड-ओनली स्नैपशॉट चैनल (host → client) |

## Resources & Prompts

आधिकारिक क्लाइंट दस्तावेज़ कहता है कि *"Tools are the only bridged MCP capability"* — Resources और Prompts स्थगित हैं। कंसोल प्रस्तावित upstream catalog seam को फ़ीचर-डिटेक्ट करता है और उसके आते ही रीड-ओनली सूचियाँ दिखाएगा; तब तक क्षमता बोर्ड दोनों को **upstream समर्थन की प्रतीक्षा में** दर्शाता है।

## Permissions & data

- **अनुमतियाँ**: `dshWorkshop` manifest `network:outbound` और `native-code:none` घोषित करता है।
- **डेटा**: पैनल रीड-ओनली है; यह केवल केवल-जोड़ने वाले `cordis.patch.yml` अंश लिखता है (अनुमोदित, बैकअप-प्रथम)। URL क्रेडेंशियल, userinfo पासवर्ड, हेडर मान, बियरर टोकन और JWT रेंडर से पहले रिडैक्ट होते हैं; कॉन्फ़िगर किए गए `headers` कभी किसी स्नैपशॉट में नहीं जाते, और env/header के **मान** कभी host से बाहर नहीं जाते (संपादक केवल कुंजियाँ देखता है)।

## Security boundaries

- **पुल पुल ही रहता है।** ट्रांसपोर्ट, OAuth या प्रोटोकॉल में कोई बदलाव नहीं; प्रति सर्वर एक mcp-client पंक्ति, ठीक हाथ से लिखी हुई।
- **कोई नकली स्थिति नहीं।** बिना upstream अवलोकन वाले कनेक्शन फ़ील्ड `unknown` / `—` और `statusSource: 'derived'` पढ़ते हैं; एग्ज़िट कोड और stderr पूँछ कभी गढ़े नहीं जाते।
- **लेखन केवल-जोड़ने वाला, अनुमोदित, बैकअप सहित।** कंसोल कभी `cordis.patch.yml` को दोबारा नहीं लिखता; यह जनरेट किए ऑपरेशन जोड़ता है और नवीनतम `backupCount` बैकअप रखता है।
- **कोई प्रॉम्प्ट इंजेक्शन नहीं।** पैनल कोई प्रॉम्प्ट अनुभाग पंजीकृत नहीं करता; मॉडल को दिखने वाला उसका एकमात्र पाठ दो टूल/कमांड विवरण हैं।

## Known limitations

- **Resources और Prompts** upstream समर्थन की प्रतीक्षा में — आधिकारिक क्लाइंट केवल टूल जोड़ता है।
- **एग्ज़िट कोड / stderr पूँछ** तब तक *upstream समर्थन की प्रतीक्षा में* चिह्नित रहते हैं जब तक क्लाइंट उन्हें उजागर न करे।
- **रीड-ओनली पैनल** — कंसोल कभी कनेक्शन स्थिति नहीं गढ़ता; अप्रेक्षणीय फ़ील्ड `unknown` / `-1` / `—` पढ़ते हैं।

## Development

```sh
pnpm run typecheck && pnpm run typecheck:ci && pnpm test && pnpm run build && pnpm run verify:self-contained && pnpm run verify:artifacts && pnpm pack
```

`scripts/verify-headless.mjs` वास्तविक web profile बूट करता है और `/mcp` का सटीक आउटपुट छापता है। प्रकाशन: `node scripts/release.mjs <x.y.z>` पूरी जाँच चलाता है, commit करता है और स्थानीय रूप से `v<x.y.z>` टैग करता है (कभी push नहीं करता)।

## Topics

`dsh`, `dsh-plugin`, `deepseek-harness`, `deepseek`, `cordis`, `mcp`, `mcp-client`, `observability`, `panel`

## Contributors

- [@PerryLink](https://github.com/PerryLink) — निर्माता और अनुरक्षक।
- [@xiaoyuyu6420](https://github.com/xiaoyuyu6420) — क्लीन-चेकआउट बिल्ड विफलताओं के पीछे की गुम client devDependencies का निदान किया (PR #5)।

## PerryLink DSH Plugin Family

यह परियोजना [PerryLink](https://github.com/PerryLink) द्वारा अनुरक्षित [DeepSeek Harness प्लगइनों](https://github.com/PerryLink) में से एक है। अगर यह आपकी मदद करता है, तो बाकी भी संभवतः करेंगे:

| प्लगइन | एक पंक्ति में |
|---|---|
| [dsh-mask](https://github.com/PerryLink/dsh-mask) | PII मास्किंग मिडलवेयर: मॉडल सीमा पर अनाम करें, डिस्प्ले लेयर पर पुनर्स्थापित करें |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | रीड-ओनली MCP रनटाइम पैनल: /mcp कमांड + सेटिंग्स टैब, स्थिति/टूल/त्रुटियाँ |
| [dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck) | इंजीनियरिंग-अनुशासन गार्ड: आवश्यकता पूछताछ, टेस्ट गेट, विरोधी समीक्षा |
| [dsh-background-agents](https://github.com/PerryLink/dsh-background-agents) | टिकाऊ पृष्ठभूमि चाइल्ड एजेंट: वेब साइडबार, संदेश और व्यवधान |
| [dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions) | LSP निदान, फ़ॉर्मेटिंग, पूर्णता, कोड क्रियाएँ और नाम बदलना |
| [dsh-output-styles](https://github.com/PerryLink/dsh-output-styles) | Claude Code outputStyles-समकक्ष रनटाइम शैली बदलाव |
| [dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind) | Claude Code /rewind-समकक्ष: स्नैपशॉट, सत्र fork, एक-क्लिक पुनर्स्थापना |
| [dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules) | Claude Code-शैली घोषणात्मक allow/deny/ask अनुमति नियम, ऑडिट सहित |
| [dsh-auto-review](https://github.com/PerryLink/dsh-auto-review) | अनुमोदन श्रृंखला पर दूसरे मॉडल की स्वतः समीक्षा, डिफ़ॉल्ट fail-closed |
| [dsh-memento](https://github.com/PerryLink/dsh-memento) | अनुमोदित क्रॉस-सत्र मेमोरी: ctx.memory seam + SQLite + memory टूल |
| [dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security) | सुरक्षा-ऑडिट स्किल पैक: सीक्रेट स्कैन, डिपेंडेंसी और सप्लाई-चेन समीक्षा |
| [dsh-session-pin](https://github.com/PerryLink/dsh-session-pin) | वेब साइडबार में सत्र पिन करें, टिकाऊ क्रम |
| [dsh-composer-history](https://github.com/PerryLink/dsh-composer-history) | वेब कम्पोज़र के लिए टर्मिनल-शैली इनपुट इतिहास: तीर, Ctrl+R खोज |
| [dsh-github](https://github.com/PerryLink/dsh-github) | DSH के लिए GitHub PR/issue एकीकरण, हर लेखन अनुमोदित |
| [dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide) | प्लगइन-विकास ज्ञान आधार, माँग पर एजेंट स्किल के रूप में |
| [dsh-claude-move](https://github.com/PerryLink/dsh-claude-move) | Claude Code के सत्र, मेमोरी, स्किल और CLAUDE.md को DSH में स्थानांतरित करें |

## License

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel योगदानकर्ता
