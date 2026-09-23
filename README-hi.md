<div align="center">

# dsh-mcp-panel
- **1024 स्टोर चैनल**: एक बार `npm i -g dsh1024`, फिर `dsh1024 plugin --profile web add dsh-mcp-panel` ([deepseek1024.com](https://deepseek1024.com) इंस्टॉल रैंकिंग में गिना जाता है)।

**DeepSeek Harness के आधिकारिक MCP क्लाइंट के लिए MCP प्रबंधन कंसोल — सेटिंग्स पेज से MCP सर्वर जोड़ें, बदलें, हटाएँ और टूल आज़माएँ; ईमानदार स्थिति, स्वास्थ्य निदान और सुरक्षित, वापस लाने योग्य प्रोफ़ाइल लेखन के साथ।**

*आधिकारिक क्लाइंट = पुल, यह प्लगइन = कंसोल: `mcp/status` seam से स्थिति पढ़ें, केवल जोड़ने वाले, अनुमोदित प्रोफ़ाइल patch लिखें।*

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![Gitee](https://img.shields.io/badge/Gitee-mirror-c71d23?logo=gitee)](https://gitee.com/perrylink/dsh-mcp-panel)
[![DSH plugin](https://img.shields.io/badge/dsh--plugin-✅-green)](https://github.com/topics/dsh-plugin)
[![dsh-doctor](https://raw.githubusercontent.com/PerryLink/dsh-plugin-doctor/main/badges/PerryLink__dsh-mcp-panel.svg)](https://github.com/PerryLink/dsh-plugin-doctor#verified-徽章)
[![DSH Market](https://raw.githubusercontent.com/2BingLing/dsh-market/master/assets/readme/badge-top-rated.svg)](https://dsh.market/)
[![Node](https://img.shields.io/badge/node-%5E22.19%20%7C%7C%20%3E%3D24-brightgreen.svg)](#)
[![CI](https://img.shields.io/github/actions/workflow/status/PerryLink/dsh-mcp-panel/ci.yml?branch=main&label=CI)](https://github.com/PerryLink/dsh-mcp-panel/actions)
[![Version](https://img.shields.io/github/v/tag/PerryLink/dsh-mcp-panel?label=version)](https://github.com/PerryLink/dsh-mcp-panel/releases)
[![npm version](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![npm downloads](https://img.shields.io/npm/dm/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![dshfind](https://dshfind.com/api/badge/PerryLink/dsh-mcp-panel?metric=downloads&lang=hi)](https://dshfind.com/hi/plugins/PerryLink/dsh-mcp-panel?ref=badge)

[English](README.md) · [简体中文](README-zh.md) · [Español](README-es.md) · [Português](README-pt.md) · [हिन्दी](README-hi.md)

</div>

---

## Compatibility

| सतह | स्थिति |
|---|---|
| Harness | DeepSeek Harness `dsh-v0.1.7-alpha.2` (2026-09-18 को सत्यापित): `0.1.6-alpha.2` dev/test फ़ेस पर दोनों typecheck रूलर हरे (यह रेपो परिवार का कैनरी है — कोई नई त्रुटि नहीं आई), 174 टेस्ट, और पूर्ण गेट शृंखला (typecheck / typecheck:ci / test / build / verify / package)। `writePatch` का पुनः-सत्यापन इस लाइन पर मान्य है। पिछली आधार रेखा: `dsh-v0.1.7-alpha.1` (2026-09-16 को सत्यापित)। |
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
- **सर्वर CRUD** — जोड़/बदल/हटा फ़ॉर्म → जोड़ने के लिए `insert` और बदलने/हटाने के लिए id-लक्षित ओवरराइड (`- id:` + `name:` + `disabled:`/`config:`) → क्लिपबोर्ड कॉपी या अनुमोदित लेखन, स्वचालित बैकअप और loader के विरुद्ध पुनः सत्यापन के साथ।
- **Resources ब्राउज़िंग** — आधिकारिक `list_mcp_resources` / `list_mcp_resource_templates` / `read_mcp_resource` टूल से रीड-ओनली संसाधन सूची, टेम्पलेट सूची और URI पठन (`@deepseek-ai/dsh-mcp-resources` सेवा द्वारा जोड़े गए); परिणाम केवल टैब में दिखते हैं, मॉडल संदर्भ में कभी नहीं।
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
| सर्वर हटाएँ | पंक्ति मिटाएँ | `- id:` + `disabled: true` ओवरराइड (patch शब्दावली में remove नहीं) — कभी भी फिर से सक्षम करने योग्य |
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
| `writeVerifyEnabled` | `true` | सफलता बताने से पहले हर लेखन को loader के पुनः-लागू अवस्था के विरुद्ध सत्यापित करता है |
| `writeVerifyTimeoutMs` | `3000` | लेखन सत्यापन के लिए पोलिंग बजट (मि.से.) |
| `backupCount` | `5` | प्रति लेखन रखे गए `cordis.patch.yml` बैकअप |
| `catalogEntries` | `[]` | अनुशंसित निर्देशिका के लिए उपयोगकर्ता ओवरले: प्रविष्टियाँ जोड़ता है; समान `id` वाली प्रविष्टि अंतर्निहित को बदल देती है |

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

Resources अब upstream जोड़ चुका है: base bundle `@deepseek-ai/dsh-mcp-resources` माउंट करता है, आधिकारिक क्लाइंट हर कनेक्शन का संसाधन provider `ctx.mcpResources` में पंजीकृत करता है, और वह पैकेज तीन साझा टूल (`list_mcp_resources`, `list_mcp_resource_templates`, `read_mcp_resource`) रखता है। कंसोल सेवा और पंजीकृत टूल को फ़ीचर-डिटेक्ट करता है, और हर सर्वर कार्ड पर रीड-ओनली Resources ब्राउज़र (सूची / टेम्पलेट / URI पठन) देता है — हर कॉल आधिकारिक टूल पाइपलाइन से जाती है और परिणाम मॉडल संदर्भ में कभी नहीं जाते।

MCP **prompt टेम्पलेट** और **संसाधन सदस्यताएँ** अभी भी upstream स्थगित हैं; क्षमता बोर्ड Prompts को **upstream समर्थन की प्रतीक्षा में** दर्शाता है।

## Permissions & data

- **अनुमतियाँ**: `dshWorkshop` manifest `network:outbound` और `native-code:none` घोषित करता है।
- **डेटा**: पैनल रीड-ओनली है; यह केवल केवल-जोड़ने वाले `cordis.patch.yml` अंश लिखता है (अनुमोदित, बैकअप-प्रथम)। URL क्रेडेंशियल, userinfo पासवर्ड, हेडर मान, बियरर टोकन और JWT रेंडर से पहले रिडैक्ट होते हैं; कॉन्फ़िगर किए गए `headers` कभी किसी स्नैपशॉट में नहीं जाते, और env/header के **मान** कभी host से बाहर नहीं जाते (संपादक केवल कुंजियाँ देखता है)।

## Security boundaries

- **पुल पुल ही रहता है।** ट्रांसपोर्ट, OAuth या प्रोटोकॉल में कोई बदलाव नहीं; प्रति सर्वर एक mcp-client पंक्ति, ठीक हाथ से लिखी हुई।
- **कोई नकली स्थिति नहीं।** बिना upstream अवलोकन वाले कनेक्शन फ़ील्ड `unknown` / `—` और `statusSource: 'derived'` पढ़ते हैं; एग्ज़िट कोड और stderr पूँछ कभी गढ़े नहीं जाते।
- **लेखन केवल-जोड़ने वाला, अनुमोदित, बैकअप सहित।** कंसोल कभी `cordis.patch.yml` को दोबारा नहीं लिखता; यह जनरेट किए ऑपरेशन जोड़ता है, नवीनतम `backupCount` बैकअप रखता है, और सफलता बताने से पहले हर लेखन को loader के पुनः-लागू अवस्था के विरुद्ध सत्यापित करता है (छोड़ा गया patch कभी सफल नहीं दिखता)।
- **कोई प्रॉम्प्ट इंजेक्शन नहीं।** पैनल कोई प्रॉम्प्ट अनुभाग पंजीकृत नहीं करता; मॉडल को दिखने वाला उसका एकमात्र पाठ दो टूल/कमांड विवरण हैं।

## Known limitations

- **prompt टेम्पलेट और संसाधन सदस्यताएँ** upstream समर्थन की प्रतीक्षा में — आधिकारिक क्लाइंट टूल और संसाधन जोड़ता है, पर prompts या सदस्यताएँ नहीं।
- **एग्ज़िट कोड / stderr पूँछ** तब तक *upstream समर्थन की प्रतीक्षा में* चिह्नित रहते हैं जब तक क्लाइंट उन्हें उजागर न करे।
- **रीड-ओनली पैनल** — कंसोल कभी कनेक्शन स्थिति नहीं गढ़ता; अप्रेक्षणीय फ़ील्ड `unknown` / `-1` / `—` पढ़ते हैं।
- **लेखन सत्यापित होते हैं, गारंटी नहीं** — कंसोल हर लेखन को loader के पुनः-लागू अवस्था के विरुद्ध सत्यापित करता है और जब loader उसे लागू न करे (जैसे `$DSH_HOME/cordis.patch.yml` द्वारा डाली गई पंक्ति, जिसे प्रोफ़ाइल-परत patch नहीं पहुँच सकता) तो ईमानदारी से विफल होता है।

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
- [@feiler0](https://github.com/feiler0) — stdio MCP सर्वर प्रोब (stdin/stdout पर एक MCP initialize हैंडशेक) का योगदान दिया (PR #7, PR #15 के रूप में मर्ज हुआ)।

## PerryLink DSH Plugin Family

This project is one of the **45 DeepSeek Harness plugins** maintained by [PerryLink](https://github.com/PerryLink). If this one helps you, the others likely will too:

| Plugin | One-liner |
|---|---|
| **[dsh-auto-review](https://github.com/PerryLink/dsh-auto-review)** | Second-model auto-review on the approval chain, fail-closed by default | |
| **[dsh-autotier](https://github.com/PerryLink/dsh-autotier)** | Automatic strong/cheap model-tier routing with deterministic risk guards and a `/tier` command | |
| **[dsh-background-agents](https://github.com/PerryLink/dsh-background-agents)** | Durable background child agents with a Web UI sidebar, messaging and interrupt | |
| **[dsh-budget](https://github.com/PerryLink/dsh-budget)** | Cost governance for DeepSeek Harness: budgets, carbon, and latency in one panel. | |
| **[dsh-catalog](https://github.com/PerryLink/dsh-catalog)** | DSH Desktop Market standard catalog source for the PerryLink family | |
| **[dsh-cert-mcp](https://github.com/PerryLink/dsh-cert-mcp)** | Read-only MCP server exposing the certification registry: grades, snapshots and five-dimension evidence | |
| **[dsh-checkpoint-rewind](https://github.com/PerryLink/dsh-checkpoint-rewind)** | Claude Code /rewind-equivalent: snapshots, session forks, one-shot restore | |
| **[dsh-claude-move](https://github.com/PerryLink/dsh-claude-move)** | Migrate Claude Code sessions, memory, skills and CLAUDE.md into DSH | |
| **[dsh-click](https://github.com/PerryLink/dsh-click)** | Cross-platform native desktop control for DeepSeek Harness — Windows first. | |
| **[dsh-composer-history](https://github.com/PerryLink/dsh-composer-history)** | Terminal-style input history for the web composer: arrows, Ctrl+R search | |
| **[dsh-data-quality](https://github.com/PerryLink/dsh-data-quality)** | Dataset quality checks and citation cross-checks (the optional numeric bridge consumed here) | |
| **[dsh-defend](https://github.com/PerryLink/dsh-defend)** | Prompt-injection, jailbreak, and secret-leak defense for DeepSeek Harness. | |
| **[dsh-doublecheck](https://github.com/PerryLink/dsh-doublecheck)** | Engineering-discipline guard: requirements grill, test gates, adversary review | |
| **[dsh-draw](https://github.com/PerryLink/dsh-draw)** | Unified static-image generation routing for DeepSeek Harness. | |
| **[dsh-fast](https://github.com/PerryLink/dsh-fast)** | Read-only performance diagnostics for DeepSeek Harness. | |
| **[dsh-fund-research](https://github.com/PerryLink/dsh-fund-research)** | Deterministic research reports for Chinese public mutual funds | |
| **[dsh-github](https://github.com/PerryLink/dsh-github)** | GitHub PR/issues integration for DSH, every write gated by approval | |
| **[dsh-industry-research](https://github.com/PerryLink/dsh-industry-research)** | Industry research orchestration that seals its deliverables through this plugin's `ctx.researchReport.assemble` | |
| **[dsh-laya](https://github.com/PerryLink/dsh-laya)** | Laya typed decisions (`noul`/`choice`/`score`) as a first-class Cordis service and model-visible tools | |
| **[dsh-library](https://github.com/PerryLink/dsh-library)** | Local document knowledge base for DeepSeek Harness. | |
| **[dsh-local-ai](https://github.com/PerryLink/dsh-local-ai)** | Local-model (Ollama) integration for DeepSeek Harness. | |
| **[dsh-lsp-actions](https://github.com/PerryLink/dsh-lsp-actions)** | LSP diagnostics, formatting, completion, code actions and rename over language servers | |
| **[dsh-mask](https://github.com/PerryLink/dsh-mask)** | PII masking middleware: anonymize at the model boundary, restore at the display layer | |
| **[dsh-mcp-panel](https://github.com/PerryLink/dsh-mcp-panel)** | Read-only MCP runtime panel: /mcp command + Settings tab with status, tools and errors | |
| **[dsh-memento](https://github.com/PerryLink/dsh-memento)** | Approval-gated cross-session memory: ctx.memory seam + SQLite + memory tool | |
| **[dsh-observe](https://github.com/PerryLink/dsh-observe)** | OpenTelemetry and Langfuse observability exporter for DeepSeek Harness. | |
| **[dsh-output-styles](https://github.com/PerryLink/dsh-output-styles)** | Claude Code outputStyles-equivalent runtime style switching | |
| **[dsh-permission-rules](https://github.com/PerryLink/dsh-permission-rules)** | Claude Code-style declarative allow/deny/ask permission rules with audit | |
| **[dsh-plugin-certification](https://github.com/PerryLink/dsh-plugin-certification)** | Community certification registry with repro-checkable grades and badges | |
| **[dsh-plugin-doctor](https://github.com/PerryLink/dsh-plugin-doctor)** | Zero-dependency static + sandbox smoke detector for DSH plugins | |
| **[dsh-plugin-guide](https://github.com/PerryLink/dsh-plugin-guide)** | Plugin-development knowledge base as an on-demand agent skill | |
| **[dsh-plugin-kit](https://github.com/PerryLink/dsh-plugin-kit)** | Shared zero-runtime-dependency toolkit for the PerryLink DSH plugins | |
| **[dsh-plugin-upgrade](https://github.com/PerryLink/dsh-plugin-upgrade)** | One-package, one-corridor-index plugin upgrade skill: routes a repository to the matching closed corridor card | |
| **[dsh-plugin-upgrade-015](https://github.com/PerryLink/dsh-plugin-upgrade-015)** | Merged `0.1.3-alpha.1` → `0.1.5-rc.1` upgrade corridor card plus a zero-dependency seam scanner | |
| **[dsh-reach](https://github.com/PerryLink/dsh-reach)** | Multi-channel approval/question bridge: WeChat/Telegram/Feishu, session console | |
| **[dsh-research-report](https://github.com/PerryLink/dsh-research-report)** | Verifiable research-report engine: content-addressed evidence ledger and sealed versions | |
| **[dsh-score](https://github.com/PerryLink/dsh-score)** | Multi-dimensional quality scoring for DeepSeek Harness plugins. | |
| **[dsh-session-pin](https://github.com/PerryLink/dsh-session-pin)** | Pin sessions in the Web sidebar with durable ordering | |
| **[dsh-session-sync](https://github.com/PerryLink/dsh-session-sync)** | Cross-device session sync for DeepSeek Harness — a dedicated git mirror of your session store. | |
| **[dsh-skill-pack-security](https://github.com/PerryLink/dsh-skill-pack-security)** | Security-audit skill pack: secret scan, dependency and supply-chain review | |
| **[dsh-talk](https://github.com/PerryLink/dsh-talk)** | Voice-first session loop for DeepSeek Harness: talk to it, hear it answer. | |
| **[dsh-team-rooms](https://github.com/PerryLink/dsh-team-rooms)** | Cross-session team rooms: shared message bus, task board and timeline | |
| **[dsh-test-drive](https://github.com/PerryLink/dsh-test-drive)** | Isolated install-and-smoke test drives for DeepSeek Harness plugins. | |
| **[dsh-ticktick](https://github.com/PerryLink/dsh-ticktick)** | TickTick/Dida365 task bridge: session-header panel + 11 tools | |
| **[dsh-translate](https://github.com/PerryLink/dsh-translate)** | Vendor parameter translation and deterministic JSON repair for DeepSeek Harness. | |


## License

[Apache License 2.0](LICENSE) © 2026 dsh-mcp-panel योगदानकर्ता

### DSH Desktop मार्केट से इंस्टॉल करें

सभी PerryLink प्लगइन DSH Desktop के बिल्ट-इन मार्केट में देखे जा सकते हैं: **Market → Sources → add source → पेस्ट करें** `https://perrylink-dsh-catalog.perrylink.workers.dev/catalog-source.json` **→ चुनें**। इंस्टॉलेशन मार्केट के npm-identity सत्यापन और आपकी पुष्टि से ही होता है।
