/**
 * Ordinals service - Hiro API integration for inscription display
 * OrdinalsBot integration for inscription creation
 */

export interface Inscription {
  id: string;
  number: number;
  contentType: string;
  contentLength: number;
  satOrdinal: string;
  timestamp: number;
}

export interface InscriptionContent {
  type: string;
  content: string | ArrayBuffer;
}

const HIRO_API = 'https://api.hiro.so/ordinals/v1';

export async function getInscription(
  inscriptionId: string
): Promise<Inscription | null> {
  try {
    const response = await fetch(`${HIRO_API}/inscriptions/${inscriptionId}`);

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as any;

    return {
      id: data.id,
      number: data.number,
      contentType: data.content_type,
      contentLength: data.content_length,
      satOrdinal: data.sat_ordinal,
      timestamp: data.timestamp,
    };
  } catch (error) {
    console.error('Failed to fetch inscription:', error);
    return null;
  }
}

export async function getInscriptionContent(
  inscriptionId: string
): Promise<InscriptionContent | null> {
  try {
    const response = await fetch(
      `${HIRO_API}/inscriptions/${inscriptionId}/content`
    );

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get('content-type') || 'text/plain';

    if (contentType.startsWith('image/')) {
      return {
        type: contentType,
        content: await response.arrayBuffer(),
      };
    }

    return {
      type: contentType,
      content: await response.text(),
    };
  } catch (error) {
    console.error('Failed to fetch inscription content:', error);
    return null;
  }
}

// OrdinalsBot inscription creation
export interface InscribeRequest {
  receiveAddress: string;
  content: string;
  contentType: string;
  feeRate?: number;
}

export interface InscribeResponse {
  orderId: string;
  status: string;
  paymentAddress: string;
  paymentAmount: number;
}

export async function createInscription(
  apiKey: string,
  request: InscribeRequest
): Promise<InscribeResponse | null> {
  try {
    const response = await fetch('https://api.ordinalsbot.com/inscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        receiveAddress: request.receiveAddress,
        file: {
          name: 'billboard.txt',
          size: request.content.length,
          type: request.contentType,
          dataURL: `data:${request.contentType};base64,${btoa(request.content)}`,
        },
        lowPostage: true,
        feeRate: request.feeRate || 10,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('OrdinalsBot error:', error);
      return null;
    }

    return (await response.json()) as InscribeResponse;
  } catch (error) {
    console.error('Failed to create inscription:', error);
    return null;
  }
}
