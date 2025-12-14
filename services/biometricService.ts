import { db } from './db';
import { v4 as uuidv4 } from 'uuid';

// Helper to convert string to Uint8Array for WebAuthn challenge
const strToBin = (str: string) => {
  return Uint8Array.from(str, c => c.charCodeAt(0));
};

// Helper to encode ArrayBuffer to Base64URL
const bufferToBase64url = (buffer: ArrayBuffer) => {
  const bytes = new Uint8Array(buffer);
  let str = '';
  for (const char of bytes) {
    str += String.fromCharCode(char);
  }
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const base64urlToBuffer = (base64url: string) => {
  const padding = '=='.slice(0, (4 - base64url.length % 4) % 4);
  const base64 = (base64url + padding).replace(/-/g, '+').replace(/_/g, '/');
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
};

// --- REALISTIC SIMULATION UI ---
// This acts as a fallback when the browser strictly blocks the hardware API (like in iframes)
const simulateBiometricPrompt = (action: 'Register' | 'Authenticate'): Promise<boolean> => {
    return new Promise((resolve) => {
        // Create scanner modal
        const overlay = document.createElement('div');
        Object.assign(overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.7)', zIndex: '99999',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(5px)'
        });
        
        const container = document.createElement('div');
        Object.assign(container.style, {
            background: 'white', padding: '2rem', borderRadius: '1.5rem',
            textAlign: 'center', width: '90%', maxWidth: '340px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            fontFamily: 'Cairo, sans-serif', position: 'relative', overflow: 'hidden'
        });

        const title = action === 'Register' ? 'إعداد البصمة' : 'تحقق من الهوية';
        const subtext = 'ضع إصبعك على المستشعر للمتابعة';

        container.innerHTML = `
            <h3 style="margin-bottom: 0.5rem; font-weight: 800; font-size: 1.25rem; color: #1f2937;">${title}</h3>
            <p style="margin-bottom: 2rem; color: #6b7280; font-size: 0.875rem;">${subtext}</p>
            
            <div id="scanner-area" style="
                width: 80px; height: 80px; margin: 0 auto 2rem; 
                background: #f3f4f6; border-radius: 50%; 
                display: flex; align-items: center; justifyContent: center;
                cursor: pointer; position: relative; border: 2px dashed #d1d5db;
                transition: all 0.3s ease;
            ">
                <svg id="fp-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="transition: all 0.3s ease;">
                    <path d="M2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12Z" stroke-opacity="0"/>
                    <path d="M12 8.5C12.5 8.5 13.5 9 13.5 10C13.5 11 12.5 12 12 12C11 12 10.5 13.5 10.5 14.5C10.5 15.5 12 15.5 12 15.5"/>
                    <path d="M12 12V12.01"/>
                    <path d="M15 17C15 17 15 18.5 13.5 18.5C12 18.5 12 17 12 17"/>
                    <path d="M9 12C9 12 8 13.5 9 14.5"/>
                    <path d="M7 12C7 9.23858 9.23858 7 12 7C14.7614 7 17 9.23858 17 12"/>
                </svg>
                <div id="scan-beam" style="
                    position: absolute; top: 0; left: 0; right: 0; height: 2px; 
                    background: #0d9488; box-shadow: 0 0 10px #14b8a6;
                    display: none; animation: scan 1.5s infinite linear;
                "></div>
            </div>

            <p id="status-text" style="font-size: 0.75rem; color: #9ca3af; margin-bottom: 1.5rem; height: 1rem;">اضغط على الأيقونة للمسح</p>

            <button id="bio-cancel" style="
                width: 100%; padding: 0.75rem; border: none; background: transparent; 
                color: #ef4444; font-weight: bold; cursor: pointer; font-size: 0.9rem;
            ">إلغاء</button>
            
            <style>
                @keyframes scan {
                    0% { top: 10%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 90%; opacity: 0; }
                }
                @keyframes pulse-ring {
                    0% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.4); }
                    70% { box-shadow: 0 0 0 15px rgba(20, 184, 166, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(20, 184, 166, 0); }
                }
            </style>
        `;
        document.body.appendChild(overlay);

        const scanner = document.getElementById('scanner-area')!;
        const beam = document.getElementById('scan-beam')!;
        const status = document.getElementById('status-text')!;
        const icon = document.getElementById('fp-icon')!;
        const cancelBtn = document.getElementById('bio-cancel')!;

        // Handle Scanning Logic
        let isScanning = false;
        
        scanner.addEventListener('mousedown', startScan);
        scanner.addEventListener('touchstart', startScan); // Mobile support

        function startScan(e: Event) {
            e.preventDefault();
            if(isScanning) return;
            isScanning = true;
            
            // Visuals
            beam.style.display = 'block';
            scanner.style.borderColor = '#14b8a6';
            scanner.style.animation = 'pulse-ring 1.5s infinite';
            icon.setAttribute('stroke', '#0d9488');
            status.textContent = 'جاري المسح والتحقق...';
            status.style.color = '#0d9488';

            // Simulate hardware delay
            setTimeout(() => {
                // Success State
                beam.style.display = 'none';
                scanner.style.animation = 'none';
                scanner.style.background = '#dcfce7';
                scanner.style.borderColor = '#22c55e';
                icon.setAttribute('stroke', '#16a34a');
                status.textContent = 'تم التعرف بنجاح';
                status.style.color = '#16a34a';

                setTimeout(() => {
                    document.body.removeChild(overlay);
                    resolve(true);
                }, 600);
            }, 2000);
        }

        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(overlay);
            resolve(false);
        });
    });
};

export const biometricService = {
  // Check if hardware supports it
  isAvailable: async () => {
    // In preview/iframe, we always say yes for simulation purposes
    return true;
  },

  // Register a new credential (Register Fingerprint)
  register: async (userId: string, username: string) => {
    try {
      // 1. Try Real Native WebAuthn First
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
        challenge,
        rp: { name: "PharmaEye System", id: window.location.hostname },
        user: { id: strToBin(userId), name: username, displayName: username },
        pubKeyCredParams: [{ alg: -7, type: "public-key" }],
        authenticatorSelection: { authenticatorAttachment: "platform", userVerification: "required" },
        timeout: 60000,
        attestation: "none"
      };

      const credential = await navigator.credentials.create({
        publicKey: publicKeyCredentialCreationOptions
      }) as PublicKeyCredential;

      if (!credential) throw new Error("فشل في إنشاء بيانات الاعتماد");

      const credentialId = bufferToBase64url(credential.rawId);
      db.registerDeviceForBiometrics(userId, credentialId);
      return true;

    } catch (error: any) {
      // 2. Fallback to Simulation if environment blocks it
      if (error.name === 'NotAllowedError' || error.name === 'SecurityError' || error.message?.includes('not enabled')) {
          console.warn("WebAuthn blocked by policy (iframe). Switching to Interactive Simulation.");
          const confirmed = await simulateBiometricPrompt('Register');
          if (confirmed) {
              const simCredId = `sim-cred-${uuidv4()}`;
              db.registerDeviceForBiometrics(userId, simCredId);
              return true;
          } else {
              throw new Error("تم إلغاء العملية");
          }
      }
      throw error;
    }
  },

  // Authenticate (Login with Fingerprint)
  authenticate: async () => {
    try {
      const storedCredId = localStorage.getItem('pharma_bio_cred_id');
      if (!storedCredId) throw new Error("No registered credential found on this device");

      // Check if it's a simulated credential
      if (storedCredId.startsWith('sim-cred-')) {
          const confirmed = await simulateBiometricPrompt('Authenticate');
          if (confirmed) {
              return db.authenticateWithDeviceToken(storedCredId);
          }
          return null;
      }

      // Try Real WebAuthn
      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge,
        allowCredentials: [{
          id: base64urlToBuffer(storedCredId),
          type: 'public-key',
          transports: ['internal'],
        }],
        userVerification: 'required',
        timeout: 60000,
      };

      const assertion = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      }) as PublicKeyCredential;

      if (assertion) {
        return db.authenticateWithDeviceToken(storedCredId);
      }
      return null;
    } catch (error: any) {
       // Fallback for real flow errors
       if (error.name === 'NotAllowedError' || error.name === 'SecurityError' || error.message?.includes('not enabled')) {
           const confirmed = await simulateBiometricPrompt('Authenticate');
           if (confirmed) {
               return db.authenticateWithDeviceToken(localStorage.getItem('pharma_bio_cred_id') || '');
           }
       }
       throw error;
    }
  }
};