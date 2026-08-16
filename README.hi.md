# dsh-mcp-panel

**DeepSeek Harness के आधिकारिक MCP क्लाइंट के लिए MCP प्रबंधन कंसोल — सेटिंग्स पेज से MCP सर्वर जोड़ें, बदलें, हटाएँ और टूल आज़माएँ; ईमानदार स्थिति, स्वास्थ्य निदान और सुरक्षित, वापस लाने योग्य प्रोफ़ाइल लेखन के साथ।**

[English](README.md) · [简体中文](README.zh.md) · [Español](README.es.md) · [Português](README.pt.md) · [हिन्दी](README.hi.md)

[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/dsh-mcp-panel)](https://www.npmjs.com/package/dsh-mcp-panel)
[![CI](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml/badge.svg)](https://github.com/PerryLink/dsh-mcp-panel/actions/workflows/ci.yml)
[![dsh-plugin](https://img.shields.io/badge/ecosystem-dsh--plugin-8b5cf6)](https://github.com/topics/dsh-plugin)

## आर्किटेक्चर: आधिकारिक क्लाइंट पुल है; यह प्लगइन कंसोल है

[`@deepseek-ai/dsh-mcp-client`](https://github.com/deepseek-ai/deepseek-harness/tree/master/packages/mcp/mcp-client) **एकमात्र पुल** है: प्रति MCP सर्वर एक इंस्टेंस, हाथ से लिखी `cordis.yml` पंक्ति के रूप में, जो ट्रांसपोर्ट जोड़ता है, टूल सिंक करता है और `mcp__<server>__<tool>` नाम पंजीकृत करता है। यह प्लगइन उसे कभी नहीं बदलता: यह उसके ऊपर की **अनुभव परत** है:

```
 profile/composition          dsh-mcp-client (पुल)         dsh-mcp-panel (कंसोल)
 - id: mcp-github             • ट्रांसपोर्ट                • /mcp कमांड
   name: '@deepseek-ai/…'     • टूल सिंक                   • सेटिंग्स → प्लगइन्स → MCP:
   config: { serverName, … }  • mcp__* टूल                   CRUD, ट्रायल कंसोल,
 - id: mcp-panel              • mcp/status seam ◄─स्थिति─►  निदान, प्रोब
   name: dsh-mcp-panel
```

कंसोल `mcp/status` seam (इवेंट + `mcpStatus` सेवा), टूल रजिस्ट्री और loader से **पढ़ता** है; **लिखता** केवल प्रोफ़ाइल की patch परत में — केवल जोड़ता है, अनुमोदन के साथ, स्वचालित बैकअप के साथ। ट्रांसपोर्ट, OAuth और प्रोटोकॉल अछूते रहते हैं।

## कंसोल बनाम हाथ से लिखा cordis.yml

| | हाथ से लिखा cordis.yml | dsh-mcp-panel कंसोल |
|---|---|---|
| सर्वर जोड़ें | YAML संपादित करें | फ़ॉर्म → patch अंश → **कॉपी** या **लिखें** (अनुमोदन + बैकअप) |
| सर्वर बदलें | YAML संपादित करें, रीस्टार्ट करें | पहले से भरा फ़ॉर्म; बिना बदले सीक्रेट host पर ही रहते हैं |
| सर्वर हटाएँ | पंक्ति मिटाएँ | `set disabled: true` ऑपरेशन (patch शब्दावली में remove नहीं है); कभी भी फिर से सक्षम करने योग्य |
| स्थिति देखें | लॉग पढ़ें | बैज + रीकनेक्ट + अंतिम त्रुटि, `mcp/status` से लाइव |
| टूल आज़माएँ | मॉडल से कहें | ट्रायल कंसोल → आधिकारिक `ctx.tools.execute()` पाइपलाइन (अनुमतियाँ और अनुमोदन लागू) |
| निदान करें | लॉग grep करें | `/mcp <server> health` व्युत्पन्न सुझावों के साथ |

## क्या मिलता है

- **`/mcp`**: प्रति सर्वर एक पंक्ति — ट्रांसपोर्ट, लक्ष्य, टूल गिनती, कनेक्शन स्थिति (ईमानदार: upstream डेटा के बिना `unknown`), अंतिम त्रुटि, रीकनेक्ट; मॉडल-पठनीय, सत्र लॉग से पुनर्निर्माण योग्य, पाँच आउटपुट भाषाएँ।
- **`/mcp <server> tools | health | call <tool> [json] | disable | enable`**: टूल सूची; व्युत्पन्न निदान (ENOENT → अनुपलब्ध निर्भरता, ECONNREFUSED, टाइमआउट, 401/403/404, DNS, दर सीमा, रीकनेक्ट समाप्त); **आधिकारिक पाइपलाइन** से परीक्षण कॉल (अनुमतियाँ + अनुमोदन लागू); सटीक patch सुझाव।
- **सेटिंग्स → प्लगइन्स → MCP**: बैज और निदान वाले स्थिति कार्ड, **सर्वर CRUD** (`insert`/`set`/`set disabled` अंश, क्लिपबोर्ड कॉपी या अनुमोदन + `cordis.patch.yml.bak-<ts>` बैकअप के साथ लेखन), **टूल ट्रायल कंसोल** (कैनोनिकल JSON परिणाम + रेंडर सामग्री, `trialMaxResultChars` द्वारा सीमित, केवल पैनल) और **क्षमता बोर्ड**: Resources व Prompts *upstream समर्थन की प्रतीक्षा में* चिह्नित (आज आधिकारिक क्लाइंट केवल टूल जोड़ता है)।
- **प्रोब**: एक-क्लिक या निष्क्रिय Streamable HTTP कनेक्टिविटी जाँच (परिणाम केवल पैनल)।

## त्वरित शुरुआत

```sh
dsh plugin --profile web add github:PerryLink/dsh-mcp-panel#v0.4.0
# या npm चैनल:
dsh plugin --profile web add dsh-mcp-panel@0.4.0
```

रीस्टार्ट करें (या वेब सतह को `cordis.patch.yml` हॉट-रीलोड करने दें) और **सेटिंग्स → प्लगइन्स → MCP** खोलें, या `/mcp` चलाएँ।

## अनुबंध के अनुसार ईमानदार

- **पुल पुल ही रहता है**: ट्रांसपोर्ट/OAuth/प्रोटोकॉल में कोई बदलाव नहीं।
- **कोई नकली स्थिति नहीं**: upstream डेटा के बिना `unknown` / `—` और `statusSource: 'derived'`; एग्ज़िट कोड व stderr कभी गढ़े नहीं जाते (*upstream समर्थन की प्रतीक्षा में* चिह्नित)।
- **सेनेटाइज़्ड प्रदर्शन**: URL क्रेडेंशियल, userinfo, हेडर मान, बियरर टोकन और JWT रिडैक्ट होते हैं; env/headers के **मान** कभी host से बाहर नहीं जाते (संपादक केवल कुंजियाँ देखता है)।
- **लेखन केवल-जोड़ने वाला, अनुमोदित, बैकअप सहित**: कंसोल कभी `cordis.patch.yml` को दोबारा नहीं लिखता; अनुमोदन सेवा और खुले टर्न वाला एजेंट होने पर `ctx.approval` से पूछता है (केवल `allowed-once` आगे बढ़ता है); अन्यथा इंटरैक्टिव पुष्टि ही अनुमोदन माध्यम है। `writeEnabled: false` कठोर स्विच है।
- **कोई प्रॉम्प्ट इंजेक्शन नहीं**: कंसोल कोई प्रॉम्प्ट अनुभाग पंजीकृत नहीं करता; केवल उसके दो टूल/कमांड विवरण, आधिकारिक क्लाइंट की न्यूनतम शैली में।

## कॉन्फ़िगरेशन

| कुंजी | मान | विवरण |
|---|---|---|
| `probeEnabled` / `probeTimeoutMs` / `maxProbes` | `true` / `10000` / `10` | प्रोब टूल, समय सीमा, दिखाए गए रिकॉर्ड |
| `refreshIntervalMs` | `0` | सुझाया गया पैनल रीफ़्रेश (`0` = मांग पर) |
| `outputLanguage` | `en` | `/mcp` भाषा: `en\|zh\|es\|pt\|hi` |
| `passiveProbeEnabled` / `passiveProbeIntervalMs` | `false` / `60000` | निष्क्रिय प्रोब और अंतराल |
| `trialEnabled` / `trialTimeoutMs` / `trialMaxResultChars` | `true` / `120000` / `60000` | ट्रायल कंसोल और उसकी सीमाएँ |
| `writeEnabled` / `backupCount` | `true` / `5` | लेखन स्विच; रखे गए बैकअप |

## Resources और Prompts

आधिकारिक क्लाइंट दस्तावेज़ कहता है "Tools are the only bridged MCP capability": दोनों स्थगित हैं। कंसोल प्रस्तावित कैटलॉग seam को फ़ीचर-डिटेक्ट करता है और उसके आते ही रीड-ओनली सूचियाँ दिखाएगा; तब तक क्षमता बोर्ड *upstream समर्थन की प्रतीक्षा में* दर्शाता है (harness के `docs/upstream-proposal.md` में अनुपूरक)।

## लाइसेंस

Apache-2.0 — देखें [LICENSE](LICENSE)।
