import { useState, useEffect } from 'react';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

const BIO_CREDS_KEY = 'strive_bio_creds';

interface BioCreds {
  email: string;
  password: string;
}

export function useBiometric() {
  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [hasSavedCreds, setHasSavedCreds] = useState(false);
  const [authType, setAuthType] = useState<string>('Biometria');

  useEffect(() => {
    async function check() {
      const hardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      setIsSupported(hardware);
      setIsEnrolled(enrolled);

      if (hardware && enrolled) {
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setAuthType('Face ID');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setAuthType('Digital');
        }

        const creds = await SecureStore.getItemAsync(BIO_CREDS_KEY);
        setHasSavedCreds(!!creds);
      }
    }
    check();
  }, []);

  const available = isSupported && isEnrolled;

  async function authenticate(): Promise<BioCreds | null> {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Confirme sua identidade para entrar',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar senha',
      disableDeviceFallback: false,
    });

    if (!result.success) return null;

    const raw = await SecureStore.getItemAsync(BIO_CREDS_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as BioCreds;
  }

  async function saveCreds(email: string, password: string) {
    await SecureStore.setItemAsync(BIO_CREDS_KEY, JSON.stringify({ email, password }));
    setHasSavedCreds(true);
  }

  async function clearCreds() {
    await SecureStore.deleteItemAsync(BIO_CREDS_KEY);
    setHasSavedCreds(false);
  }

  return { available, hasSavedCreds, authType, authenticate, saveCreds, clearCreds };
}
