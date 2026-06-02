function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function normalizeProfile(profile = {}) {
    return {
        pattern: profile.pattern || 'wall-generic',
        source: profile.source || 'local-ai-bot',
        qualityScore: clamp(Number(profile.qualityScore) || 0.5, 0, 1),
        aspectRatio: clamp(Number(profile.aspectRatio) || 1, 0.2, 5),
        metersPerRepeat: clamp(Number(profile.metersPerRepeat) || 1.5, 0.35, 8),
        minRepeat: clamp(Number(profile.minRepeat) || 0.6, 0.2, 8),
        maxRepeat: clamp(Number(profile.maxRepeat) || 6, 0.5, 20),
        roughness: profile.roughness == null ? null : clamp(Number(profile.roughness), 0.02, 1),
        metalness: clamp(Number(profile.metalness) || 0.03, 0, 1),
        normalStrength: clamp(Number(profile.normalStrength) || 1, 0.1, 2.5),
        reliefStrength: clamp(Number(profile.reliefStrength) || 0.4, 0, 2.5),
        bumpScale: clamp(Number(profile.bumpScale) || 0.01, 0, 0.08),
        useGeneratedRelief: Boolean(profile.useGeneratedRelief),
        preserveMotif: Boolean(profile.preserveMotif),
        useTriplanarHint: Boolean(profile.useTriplanarHint)
    };
}

function buildMaterialAdaptationPayload(scanResult = {}) {
    const overrides = scanResult.overrides && typeof scanResult.overrides === 'object'
        ? scanResult.overrides
        : {};
    const profilesRaw = scanResult.profiles && typeof scanResult.profiles === 'object'
        ? scanResult.profiles
        : {};
    const stats = scanResult.stats && typeof scanResult.stats === 'object'
        ? scanResult.stats
        : {};

    const profiles = {};
    Object.entries(profilesRaw).forEach(([materialId, profile]) => {
        profiles[materialId] = normalizeProfile(profile);
    });

    return {
        overrides,
        profiles,
        stats: {
            materialsDetected: Number(stats.materialsDetected) || 0,
            variantMaterialsDetected: Number(stats.variantMaterialsDetected) || 0,
            imagesDetected: Number(stats.imagesDetected) || 0
        }
    };
}

module.exports = {
    buildMaterialAdaptationPayload
};
