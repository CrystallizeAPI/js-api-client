import fs from 'fs';
import mime from 'mime-lite';
import { ClientInterface } from '../client/create-client.js';

type BinaryInputWithReferenceId = {
    filename: string;
    mimeType: string;
};

type BinaryHandler = BinaryInputWithReferenceId & {
    buffer: NonSharedBuffer;
    type: 'MEDIA' | 'STATIC' | 'MASS_OPERATIONS';
};

const generatePresignedUploadRequest = `#graphql
    mutation GET_URL($file: String!, $contentType: String!, $type: FileUploadType!) {
    generatePresignedUploadRequest(
        filename: $file
        contentType: $contentType
        type: $type
    ) {
        ... on PresignedUploadRequest {
          url
          fields {
            name
            value
          }
          maxSize
          lifetime
        }
        ... on BasicError {
          error: message
        }
    }
}`;

export const createBinaryFileManager = (apiClient: ClientInterface) => {
    // this function returns the key of the uploaded file
    const uploadToTenant = async ({ type = 'MEDIA', mimeType, filename, buffer }: BinaryHandler): Promise<string> => {
        const signedRequestResult = await apiClient.nextPimApi<{
            generatePresignedUploadRequest: {
                url: string;
                fields: Array<{ name: string; value: string }>;
            };
        }>(generatePresignedUploadRequest, {
            file: filename,
            contentType: mimeType,
            type: type || 'MEDIA',
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

    const uploadImage = async (path: string): Promise<string> => {
        const extension = path.split('.').pop() as string;
        const mimeType = mime.getType(extension);
        const filename = path.split('/').pop() as string;
        if (!mimeType) {
            throw new Error(`Could not determine mime type for file: ${path}`);
        }
        if (!mimeType.includes('image')) {
            throw new Error(`File is not an image: ${path}`);
        }
        const buffer = fs.readFileSync(path);
        const key = await uploadToTenant({
            mimeType,
            filename,
            buffer,
            type: 'MEDIA',
        });
        const registerImage = `#graphql
            mutation REGISTER_IMAGE($key: String!, $tenantId: ID!) {
            image {
                registerImage(key: $key, tenantId: $tenantId) {
                key
                }
            }
        }`;
        await apiClient.pimApi(registerImage, {
            key,
            tenantId: apiClient.config.tenantId,
        });
        return key;
    };

    const uploadFile = async (path: string): Promise<string> => {
        const extension = path.split('.').pop() as string;
        const mimeType = mime.getType(extension);
        const filename = path.split('/').pop() as string;
        const buffer = fs.readFileSync(path);
        return await uploadToTenant({
            mimeType,
            filename,
            buffer,
            type: 'STATIC',
        });
    };

    const uploadMassOperationFile = async (path: string): Promise<string> => {
        const extension = path.split('.').pop() as string;
        const mimeType = mime.getType(extension);
        const filename = path.split('/').pop() as string;
        const buffer = fs.readFileSync(path);
        return await uploadToTenant({
            mimeType,
            filename,
            buffer,
            type: 'MASS_OPERATIONS',
        });
    };

    return {
        uploadToTenant,
        uploadImage,
        uploadFile,
        uploadMassOperationFile,
    };
};
