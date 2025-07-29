import * as fs from 'fs';
import * as mime from 'mime-lite';
import { ClientInterface } from '../client/create-client.js';

type ImageInputWithReferenceId = {
    filename: string;
    mimeType: string;
};

type UploadHandler = ImageInputWithReferenceId & {
    buffer: NonSharedBuffer;
};

const MUTATION_UPLOAD_FILE = `#graphql
mutation UPLOAD_FILE ($filename: String!, $mimeType: String!) {
    generatePresignedUploadRequest(
        filename: $filename
        contentType: $mimeType
        type: MEDIA
    ) {
        ... on PresignedUploadRequest {
            url
            fields {
                name
                value
            }
        }
        ... on BasicError {
            errorName
            message
        }
    }
}`;

export const createBinaryFileManager = (apiClient: ClientInterface) => {
    // this function returns the key of the uploaded file
    const uploadToTenant = async ({ mimeType, filename, buffer }: UploadHandler): Promise<string> => {
        const signedRequestResult = await apiClient.nextPimApi<{
            generatePresignedUploadRequest: {
                url: string;
                fields: Array<{ name: string; value: string }>;
            };
        }>(MUTATION_UPLOAD_FILE, {
            filename,
            mimeType,
        });

        const payload = signedRequestResult.generatePresignedUploadRequest;
        const formData: FormData = new FormData();
        payload.fields.forEach((field: { name: string; value: string }) => {
            formData.append(field.name, field.value);
        });
        formData.append('file', new Blob([buffer]));

        const response = await fetch(payload.url, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Failed to upload file: ${response.statusText}`);
        }

        if (response.status !== 201) {
            throw new Error(`Unexpected response status: ${response.status}`);
        }
        return formData.get('key') as string;
    };

    const uploadImage = async (imagePath: string): Promise<string> => {
        const extension = imagePath.split('.').pop() as string;
        const mimeType = mime.getType(extension);
        const filename = imagePath.split('T/').pop() as string;
        if (!mimeType) {
            throw new Error(`Could not determine mime type for file: ${imagePath}`);
        }
        if (!mimeType.includes('image')) {
            throw new Error(`File is not an image: ${imagePath}`);
        }
        const buffer = fs.readFileSync(imagePath);
        const imageKey = await uploadToTenant({
            mimeType,
            filename,
            buffer,
        });

        return imageKey;
    };

    return {
        uploadToTenant,
        uploadImage,
    };
};
