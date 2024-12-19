const generateRandomPermutation = (size) => {
    const array = Array.from({ length: size }, (_, i) => i);
    for (let i = size - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
};

const generateSubstitutionBox = () => {
    return Array(8).fill().map(() => generateRandomPermutation(16));
};

const addBuffer = (data, blockSize = 8) => {
    const bufferLength = blockSize - (data.length % blockSize);
    const buffer = new Uint8Array(bufferLength).fill(bufferLength);
    return new Uint8Array([...data, ...buffer]);
};

const removeBuffer = (data) => {
    const bufferLength = data[data.length - 1];
    return data.slice(0, data.length - bufferLength);
};

const substitution = (value, substitutionBox) => {
    let result = 0;
    for (let i = 0; i < 8; i++) {
        const temp = (value >> (4 * i)) & 0x0f;
        result |= substitutionBox[i][temp] << (4 * i);
    }
    return result;
};

const generateSubkeys = (key) => {
    const subkeys = [];
    for (let i = 0; i < 8; i++) {
        subkeys[i] = new DataView(key.buffer).getUint32(4 * i, true);
    }
    return subkeys;
};

const generateRandomKey = () => {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let key = '';
    for (let i = 0; i < 32; i++) {
        const randomIndex = Math.floor(Math.random() * characters.length);
        key += characters[randomIndex];
    }
    return key;
};

const encryptBlock = (block, subkeys, substitutionBox) => {
    let left = new DataView(block.buffer).getUint32(0, true);
    let right = new DataView(block.buffer).getUint32(4, true);

    for (let i = 0; i < 32; i++) {
        const keyIndex = i < 24 ? (i % 8) : (7 - i % 8);
        let temp = (left + subkeys[keyIndex]) % 2 ** 32;
        temp = substitution(temp, substitutionBox);
        temp = (temp << 11) | (temp >>> 21);
        temp ^= right;
        if (i < 31) {
            right = left;
            left = temp;
        } else {
            right = temp;
        }
    }

    const result = new ArrayBuffer(8);
    const resultView = new DataView(result);
    resultView.setUint32(0, left, true);
    resultView.setUint32(4, right, true);
    return new Uint8Array(result);
};

const decryptBlock = (block, subkeys, substitutionBox) => {
    let left = new DataView(block.buffer).getUint32(0, true);
    let right = new DataView(block.buffer).getUint32(4, true);

    for (let i = 0; i < 32; i++) {
        const keyIndex = i < 8 ? (i % 8) : (7 - i % 8);
        let temp = (left + subkeys[keyIndex]) % 2 ** 32;
        temp = substitution(temp, substitutionBox);
        temp = (temp << 11) | (temp >>> 21);
        temp ^= right;
        if (i < 31) {
            right = left;
            left = temp;
        } else {
            right = temp;
        }
    }

    const result = new ArrayBuffer(8);
    const resultView = new DataView(result);
    resultView.setUint32(0, left, true);
    resultView.setUint32(4, right, true);
    return new Uint8Array(result);
};


//нет, ну извините, оно даже с фиксированным ключем 16 бит не работает, в чем ПрОбЛеМаАаАаА
const bruteForceDecrypt = (encryptedData, originalText, substitutionBox) => {
    const originalBytes = new TextEncoder().encode(originalText);

    for (let keyCandidate = 0; keyCandidate < 2 ** 16; keyCandidate++) {
        const keyBytes = new Uint8Array(32).fill(0);
        const keyView = new DataView(keyBytes.buffer);
        keyView.setUint32(0, keyCandidate, true);
        const subkeys = generateSubkeys(keyBytes);

        const dataBytes = new Uint8Array(atob(encryptedData).split('').map(char => char.charCodeAt(0)));

        const decryptedResult = new Uint8Array(dataBytes.length);
        for (let i = 0; i < dataBytes.length / 8; i++) {
            const block = dataBytes.slice(i * 8, (i + 1) * 8);
            const decryptedBlock = decryptBlock(block, subkeys, substitutionBox);
            decryptedResult.set(decryptedBlock, i * 8);
        }

        const decryptedText = new TextDecoder().decode(removeBuffer(decryptedResult));

        if (decryptedText === originalText) {
            return keyBytes;
        }
    }
    return null;
};

//DOM элементы
const inputText = document.getElementById('inputText');
const encryptionKey = document.getElementById('encryptionKey');
const encryptedText = document.getElementById('encryptedText');
const decryptedText = document.getElementById('decryptedText');
const hashOutput = document.getElementById('hash');
const encryptButton = document.getElementById('encryptButton');
const decryptButton = document.getElementById('decryptButton');
const hashButton = document.getElementById('hashButton');
const bruteForceButton = document.getElementById('bruteForceButton');
const resetButton = document.getElementById('resetButton');
const generateKeyButton = document.getElementById('generateKeyButton');

let substitutionBox = generateSubstitutionBox();

const resetFields = () => {
    inputText.value = '';
    encryptionKey.value = '';
    encryptedText.textContent = '';
    decryptedText.textContent = '';
    hashOutput.textContent = '';
    substitutionBox = generateSubstitutionBox();
};

const generateKey = () => {
    encryptionKey.value = generateRandomKey();
};

const encryptText = () => {
    if (encryptionKey.value.length !== 32) {
        alert('Ключ должен быть длиной 32 символа.');
        return;
    }

    const keyBytes = new TextEncoder().encode(encryptionKey.value);
    const subkeys = generateSubkeys(keyBytes);
    let dataBytes = new TextEncoder().encode(inputText.value);

    dataBytes = addBuffer(dataBytes);

    const result = new Uint8Array(dataBytes.length);

    for (let i = 0; i < dataBytes.length / 8; i++) {
        const block = dataBytes.slice(i * 8, (i + 1) * 8);
        const encryptedBlock = encryptBlock(block, subkeys, substitutionBox);
        result.set(encryptedBlock, i * 8);
    }

    encryptedText.textContent = btoa(String.fromCharCode.apply(null, result));
};

const decryptText = () => {
    if (!encryptedText.textContent) {
        alert('Сначала зашифруйте текст.');
        return;
    }

    const keyBytes = new TextEncoder().encode(encryptionKey.value);
    const subkeys = generateSubkeys(keyBytes);

    const resultBase64 = atob(encryptedText.textContent);
    const dataBytes = new Uint8Array(resultBase64.length);
    for (let i = 0; i < resultBase64.length; i++) {
        dataBytes[i] = resultBase64.charCodeAt(i);
    }

    const result = new Uint8Array(dataBytes.length);

    for (let i = 0; i < dataBytes.length / 8; i++) {
        const block = dataBytes.slice(i * 8, (i + 1) * 8);
        const decryptedBlock = decryptBlock(block, subkeys, substitutionBox);
        result.set(decryptedBlock, i * 8);
    }

    decryptedText.textContent = new TextDecoder().decode(removeBuffer(result));
};

const calculateDigest = () => {
    if (!inputText.value) {
        alert('Введите текст для хеширования.');
        return;
    }

    const keyBytes = new TextEncoder().encode(encryptionKey.value);
    const subkeys = generateSubkeys(keyBytes);
    let dataBytes = new TextEncoder().encode(inputText.value);
    dataBytes = addBuffer(dataBytes);

    let intermediateResult = new Uint8Array(8);
    for (let offset = 0; offset < dataBytes.length; offset += 8) {
        const chunk = dataBytes.slice(offset, offset + 8);
        const encryptedIntermediate = encryptBlock(intermediateResult, subkeys, substitutionBox);
        intermediateResult = intermediateResult.map((byte, idx) =>
            (encryptedIntermediate[idx] + chunk[idx] + byte) & 0xFF
        );
    }

    hashOutput.textContent = Array.from(intermediateResult)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join('');
};

const bruteForceAttack = () => {
    if (!encryptedText.textContent || !inputText.value) {
        alert('Введите текст и зашифруйте его для теста взлома.');
        return;
    }

    const key = bruteForceDecrypt(encryptedText.textContent, inputText.value, substitutionBox);

    if (key) {
        alert('Ключ найден: ' + new TextDecoder().decode(key));
    } else {
        alert('Ключ не найден.');
    }
};

// Event listeners
encryptButton.addEventListener('click', encryptText);
decryptButton.addEventListener('click', decryptText);
hashButton.addEventListener('click', calculateDigest);
bruteForceButton.addEventListener('click', bruteForceAttack);
resetButton.addEventListener('click', resetFields);
generateKeyButton.addEventListener('click', generateKey);
