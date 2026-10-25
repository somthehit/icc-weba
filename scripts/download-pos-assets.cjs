const fs = require('fs');
const https = require('https');
const path = require('path');

const screens = [
  {
    num: 1,
    id: '2b23b8a65c2d45ab9f54e8a6394c5c9e',
    name: 'pos_logo',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1WeHKRgz_5ZuFPuXOXCIhY4klB42XvPegbZtGqxfzowd_s0SEysMmDSlEfdUjTUHd0OjCbQdCUCzoRLHAdPn-gZpFBS_EhNAEEceTYjjOKZnsthfgvGytkKVwOI9UQcpLg7WnJTkJWhDynZ-wY61d-Q1Sn6BH-Kl90UAXChgTcTte51m-yufSneCIakluYGTeiod3MQYV1Dim_yXb3d3QhzS15PtAOgCiNOJJ2RQgtfBa2EOczHh-V8wEd2',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0MGQwZjZkZDgwNWMyZmMwMTlmMWQxNzQyEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'svg'
  },
  {
    num: 2,
    id: 'fd5d15a49fc04491bd97db3a2944a971',
    name: 'cashier_portrait',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1XqfwSwjlRm-OgiCgGjUAjy1LbRiFOwRcC9i1DBQolX3CVIIG9c5OeBZE8r6TE1RY1YO13OArPGvnwQ0SEDFXciH2in2jwcOwFNtYMP84D88rEfC5C08iP5kToUG9c_EQfqUBg1SP0XoaOk2VdLP4EkjH5512w__5vRPknsH1x2pnNlPwUf5MQmh3UeGtxtg5Xn1UIkjNQ3d5PNmvv8iI42U7hrTidzFMczf8MwOzkHZPvamalpjW--xzc',
    codeUrl: null
  },
  {
    num: 3,
    id: '53278851ed344ac9aadfe6ba3b37c82e',
    name: 'sales_workspace',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1UIKkstRHm5AWIbINTNbXj0IMyXVMEJvsRKTsjj_u9wfcxq36_rzNCBIIlhercZnF5NCf4kWLCAM1Sotyf84hEFzMQvcodzH-9HpS4KLfr-jiIQ48ecx75tYvr-YpWOk-1FlIHastVMfKZLCq_NuRWLXzNIvAMKS1vN1ILe47LUFT68Y_QC7BEqZ9R9YmHKsWMS_mXErUg1kj_BQG5mwbzfZmSWYDEhePEmYWtmF6ZgseqRK22JzNYgEck',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0MTRiOGFiZWIwNzllNmU5OTUyMzEwMjBjEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 4,
    id: '5e9d03fb23ee4f2eb388d8fba7d553ff',
    name: 'payment_tender',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1WqjW6w73Kkrca_HwbaulldmlTypCXShICcB_1Xx8t8__rH_ghPV7qBRtrcznaKr1f_EDmWCfZCBpr_heIb3HY0t4BncoEm16ufK8K00CeYLTQJuhZ222gjxt6Kmh5UukQBkBMnuskHajgDA0cOTqcG4wyS_e8FkiKfluhlsKStnDVo0kzT1SQJzdCo1Dlmr7VALE2Hcpdwl-tw6fj_kL27WECCxBjBAnUBf3pjA0qCoNSf-Id5OU99ZFq5',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0MTM0ZjU4NzUwN2UwMDQwN2FjMTA5MWMwEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 5,
    id: 'a00a4b187df04df889cac69249dab70f',
    name: 'staff_auth_lock',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1XVIiHFIEJxP0X31fXP9eBlyY9DR5j06kT7FQADh38Ow1m1R4lICWh22qLp8C0iNdrwmh9HFvZq8uAYOjHK93HYEXMZ5l32J0XHZYApFL5UD2X8XafRg7RizWRtGZAOggTBwqbUbenWT1WLkUdS6R-zfKKHY9dHcBgiuOQloukkvrHPFpYn9i99yhjwtXv60jWdOYQs87lnavMra3v-eiHX6vDdqZ9TanB_Bj-bRw9TVfR2p9n-IS5L9wPb',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0MTRlZGQ1M2MwNTc2MDE0NTc4MDMyZjFiEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 6,
    id: '992817cceca543c79584622e062c2601',
    name: 'cash_register_reconciliation',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VlUUzcnYRxFKWbdbajCgewkuZWPRIeia1SBrSGU8mWa_Mi5WlDTKN9q3psdRwPMwzSyw3OHyMduygCNcKfpDRutNnSm3uQXS2y73W1ShtsezlEu3qJckFmsFIPzWifH7IAlMRSJ_NImKrWG2Gsf-09wTyqlPDr4TBjP3qRxJHlxjBZMtmUz4y6tL3AYbX8XZO9e7jRGTZg9fJWSIecLU5HSDrY2VuVqxGb0LASEDiW2jSR5j9X0njpmSc',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0MWZmYmU2ZDkwMDMwMWY1YzhkMzBmNDFmEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 7,
    id: '3446ab50da1143f2b645cb48767918cc',
    name: 'sales_history_lookup',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1Uh4wgCYbIXvkpAXnE1laP5drQopjrIJ9QUPRruFPExbLsFKopDVJf4Gjh--Xmr188BD6cpP31Crvw26iqGDjnsAAqF8kwZT3f0P3J_NNFoqgjFPtztfjLO_ySnAJFDmx8alMDKLAXLQrk0M4X7jyJg7JiIinUcJfVNhV8umK-A8FizjCxtibgYo6LmhXq1z8kCldTIlCPYCcOrkk2m24ELM2noRqO4uS-H2ptjh8dleZZ_vs_0AmVgqLv3',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0NGI3ZTgyMTcwNmFjNmQ4M2U5MmZkMDcxEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 8,
    id: 'a5f63e64311a4a108cd58bfc1a3e237c',
    name: 'sales_return_refund',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1ViVenxWD9Cfu32vjnRYu2MklxjWeNznc7FwW42-pgYoCRRmIyoHcCHraVwDmQYDYKJh30xKL2BjO4DFlTLN-v-TaAtyNCyKVxKyFpFtaCb8l_pGdYZV9iFlNAnG9q70puMK6K1eMIM0bVa_rPkfPcg5e1sl1jkA90SnwLhbdVhDU67DxD9sgtGsGKQkqLN5S6ky2266PLRjCMNHck_y5qNKeLO4dObmPd30UMVS9AHYML_UwYKU_89ilUN',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0ODBlMjc4MzYwNTc2MDE0NTc4MDMyZjFiEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 9,
    id: 'd380f77228214ca282048c325af4867b',
    name: 'inventory_stock_management',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1XEgY82kXiBdznjotWaff_O4vtNqZcZSEB7eFnNJWFqyQLmc0CEzImg9AA65NjjqvWtDnljN92u8YxsSSKYArsoN_rvdwvWBadjObXC8Gbck_nd3uMHM9i4FB2D4dOO9_LTjoTVfUBDL6epb6MQOfchflC3UfktMoHwRjPy5ir1dDEsEhGEsKiWofnmcQmxPTORPwVR0nqldKNKZaVp8vQuPFtnMGAJbRjiz-jA9ZraTkzmng4hnkeKnGMN',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0ODRhNmUxNDgwNTIyOWNkMmYwMWM0MmYxEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 10,
    id: '6a318920cf6c4f0aa079572f1d0fbd78',
    name: 'customer_loyalty_console',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1WF5kWGb9Z9B7HVlbVT_odWZ23DUA8HlT4PVuIljfya5Q07ijUcJOLOCGYAlElj7xdsiiTDwDcyRaBLZSpBCH56cyJndltvFhlyaz9BSaXseTjVAEH7hAeWpuO02v9kx-8svmURD9k8HdTxFze8oBhFcg-QNYOuw1XryXhH2j215QRL6fEPPINmh7gVss33_TS--7hkg2fvJtG8UkmzvLERKsLDbUMjppD252pHDb0btr7wIsQvOJICAKDx',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0ODliNzZmYzYwMzkyY2ExNDg0MTRhMjNiEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 11,
    id: '42af17bb0df94b1ba478ba0015cfdc68',
    name: 'pricing_promotion_engine',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1Uth3eQ9CZgkBRgxpWGGS31qlb_46iC8TlLdhn9Jp8tbdx9kwX7Bu9OnT9u-z12LHxzsOI19O0MZ5nf0mOsPkD1MUDZfyoJ8I2kxdr_uHc02hwWdtbH0DCa_E5e8hSfUDcqE1AtAvsNod9VrvT21q8HwEJUdYeH4ES2Iw9dQMv3gGs58Taf2l__nm6yTR35U5_cQ_2KGy5W0E0m8WqMf2nfnbw06kqZ35TXf9heRWBC0EAcJ6VMhoBA6Oo',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0OGYwNmY4OWEwN2M0ZDIwYjczMjVkNTNlEgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  },
  {
    num: 12,
    id: '6a926527a5b24811b86f09ac428a29d9',
    name: 'hardware_diagnostics',
    imgUrl: 'https://lh3.googleusercontent.com/aida/AEtjO1VquaNCKV699IGMCRl1L_xeveUZaGCmPP8ez457JtaezwnohnkddBa3aiwE6o42o_E8z9_T3FLf5DpjgSG_W9sqYbl8EOt_jFY-EN2Hjak21OUwloMiWkk1_v-DosOH1gd4SErv4GyoGkAETiWjhlM6lvxjLaX846fZvk6ujI_NdchweVG9dRcb6Yebw7hrWvI-xzn4pAA9X7L5fECRBlNIX2zm6r4sPnNTxf7paa3C2Czl251yOFu8RRc',
    codeUrl: 'https://contribution.usercontent.google.com/download?c=CgthaWRhX2NvZGVmeBJ8Eh1hcHBfY29tcGFuaW9uX2dlbmVyYXRlZF9maWxlcxpbCiVodG1sXzAwMDY1Y2I0YWYzMDhlNGMwMzM4NWJkMzhiMWM3YjY0EgsSBxCxtKeimggYAZIBJAoKcHJvamVjdF9pZBIWQhQxMjU0MzUwMjIxMDU0NTc0NDA0OQ&filename=&opi=89354086',
    codeExt: 'html'
  }
];

const targetDir = path.join(process.cwd(), 'public', 'pos-assets');
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return download(res.headers.location, dest).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error('Status ' + res.statusCode + ' for ' + url));
      }
      const file = fs.createWriteStream(dest);
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', reject);
  });
}

async function run() {
  for (const s of screens) {
    const imgDest = path.join(targetDir, `${s.num}_${s.name}.png`);
    try {
      console.log(`Downloading img ${s.num}: ${s.name}...`);
      await download(s.imgUrl, imgDest);
    } catch (e) {
      console.error(`Failed img ${s.num}:`, e.message);
    }

    if (s.codeUrl) {
      const codeDest = path.join(targetDir, `${s.num}_${s.name}.${s.codeExt || 'html'}`);
      try {
        console.log(`Downloading code ${s.num}: ${s.name}...`);
        await download(s.codeUrl, codeDest);
      } catch (e) {
        console.error(`Failed code ${s.num}:`, e.message);
      }
    }
  }
  console.log('Finished downloading all assets!');
}

run();
