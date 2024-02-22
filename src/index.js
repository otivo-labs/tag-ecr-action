const AWS = require('aws-sdk');
const core = require('@actions/core');

const extractInputs = () => {
    const sourceTag = core.getInput('source-tag');
    const targetTag = core.getInput('target-tag');
    const currentTagValue = core.getInput('current-tag');

    if (!sourceTag || !targetTag || !currentTagValue) {
        console.error("Error: Environment variables are not set.");
        console.error(`sourceTag: ${sourceTag}, targetTag: ${targetTag}, currentTag: ${currentTagValue}`);
        throw new Error("Environment variables are not set.");
    }

    return {sourceTag, targetTag, currentTagValue};
};

const updateCurrentImage = async (ecrClient, repositoryName, sourceTag, currentTagValue) => {
    const response = await ecrClient.batchGetImage({
        repositoryName: repositoryName,
        imageIds: [{imageTag: sourceTag}],
        acceptedMediaTypes: ['application/vnd.docker.distribution.manifest.v1+json']
    });

    const imageDigest = response.images[0].imageId.imageDigest;
    const imageManifest = response.images[0].imageManifest;

    await ecrClient.batchDeleteImage({
        repositoryName: repositoryName,
        imageIds: [{imageTag: currentTagValue}],
    });

    await ecrClient.putImage({
        repositoryName: repositoryName,
        imageManifest: imageManifest,
        imageTag: currentTagValue,
        imageDigest: imageDigest,
    });
};

const tagImage = async (ecrClient, repositoryName, sourceTag, targetTag) => {

    try {
        const response = await ecrClient.batchGetImage({
            repositoryName: repositoryName,
            imageIds: [{imageTag: sourceTag}],
            acceptedMediaTypes: ['application/vnd.docker.distribution.manifest.v1+json']
        });

        const imageDigest = response.images[0].imageId.imageDigest;
        const imageManifest = response.images[0].imageManifest;

        // Add the new tag
        await ecrClient.putImage({
            repositoryName: repositoryName,
            imageManifest: imageManifest,
            imageTag: targetTag,
            imageDigest: imageDigest
        });

        console.log(`Tag '${targetTag}' added to the image with digest '${imageDigest}' in repository '${repositoryName}'.`);
    } catch (e) {
        console.error(`Error tagging image in repository '${repositoryName}': ${e}`);
        throw e;
    }
};

function getClient() {
    const awsAccessKeyId = core.getInput('aws-access-key-id');
    const awsSecretAccessKey = core.getInput('aws-secret-access-key');
    const region = core.getInput('region');
    return new AWS.ECR({
        region: region,
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
    });
}

const main = async () => {
    const sourceTag = core.getInput('source-tag');
    const targetTag = core.getInput('target-tag');
    const currentTagValue = core.getInput('current-tag');
    const ecrClient = getClient();


    const repoNames = core.getInput('repositories').split(',');

    for (const repoName of repoNames) {
        await tagImage(ecrClient, repoName, sourceTag, targetTag);
        await updateCurrentImage(ecrClient, repoName, sourceTag, currentTagValue);
    }

};

module.exports = {main, tagImage, updateCurrentImage, extractInputs};

if (require.main === module) {
    main().catch((e) => {
        console.error(e);
        core.setFailed(e.message);
    });
}