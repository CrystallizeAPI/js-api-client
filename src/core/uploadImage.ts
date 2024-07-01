import * as fs from 'fs';
import * as mime from 'mime-lite';
import { ClientInterface } from './client.js';

type ImageInputWithReferenceId = {
    id: string;
    filename: string;
    mimeType: string;
};

type UploadHandler = ImageInputWithReferenceId & {
    buffer: Buffer;
    stats: fs.Stats;
    apiClient: ClientInterface;
};

const MUTATION_UPLOAD_FILE = `#graphql
mutation UPLOAD_FILE ($tenantId: ID!, $filename: String!, $mimeType: String!) {
    fileUpload {
        generatePresignedRequest(
            tenantId: $tenantId
            filename: $filename
            contentType: $mimeType
            type: MEDIA
        ) {
            url
            fields {
                name
                value
            }
        }
    }
}`;

export async function uploadToTenant({
    id,
    mimeType,
    filename,
    buffer,
    stats,
    apiClient,
}: UploadHandler): Promise<string | false> {
    const signedRequestResult = await apiClient.pimApi(MUTATION_UPLOAD_FILE, {
        tenantId: id,
        filename,
        mimeType,
    });

    const payload = signedRequestResult.fileUpload.generatePresignedRequest;
    const formData: FormData = new FormData();
    payload.fields.forEach((field: { name: string; value: string }) => {
        formData.append(field.name, field.value);
    });
    formData.append('file', new Blob([buffer]));

    const response = await fetch(payload.url, {
        method: 'POST',
        body: formData,
    });

    return response.status === 201 ? (formData.get('key') as string) : false;
}

export async function handleImageUpload(
    imagePath: string,
    apiClient: ClientInterface,
    tenantId?: string,
): Promise<string | boolean> {
    if (!imagePath) {
        return 'No image path provided';
    }

    const extension = imagePath.split('.').pop() as string;
    const mimeType = mime.getType(extension);
    const filename = imagePath.split('T/').pop() as string;

    if (!mimeType) {
        return 'Could not find mime type for file. Halting upload';
    }

    if (!mimeType.includes('image')) {
        return 'File is not an image. Halting upload';
    }

    const stats = fs.statSync(imagePath);
    const buffer = fs.readFileSync(imagePath);

    const data: Omit<UploadHandler, 'id'> = {
        mimeType,
        filename,
        stats,
        buffer,
        apiClient,
    };

    const tId = apiClient.config.tenantId ?? tenantId;
    if (!tId) {
        return 'No tenant id provided';
    }

    const imageKey = await uploadToTenant({
        id: tId,
        ...data,
    });

    return imageKey;
}
