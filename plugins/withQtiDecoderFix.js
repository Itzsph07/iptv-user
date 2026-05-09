// plugins/withQtiDecoderFix.js
// FIXED: Now correctly patches MainApplication.kt (Kotlin) instead of .java

const { withDangerousMod } = require('@expo/config-plugins');
const fs   = require('fs');
const path = require('path');

const PACKAGE      = 'com.anonymous.MesaIPTV';
const PACKAGE_PATH = 'com/anonymous/MesaIPTV';

const BLOCKLIST_JAVA = `package ${PACKAGE}.decoder;

import com.google.android.exoplayer2.mediacodec.MediaCodecInfo;
import com.google.android.exoplayer2.mediacodec.MediaCodecSelector;
import com.google.android.exoplayer2.mediacodec.MediaCodecUtil;
import java.util.ArrayList;
import java.util.List;

public class QtiDecoderBlocklist {

    private static final String[] BLOCKLISTED = {
        "c2.qti.avc.decoder",
        "c2.qti.avc.decoder.low_latency",
        "c2.qti.hevc.decoder",
        "c2.qti.hevc.decoder.low_latency",
        "c2.qti.vp9.decoder",
    };

    public static MediaCodecSelector buildSelector() {
        return (mimeType, requiresSecureDecoder, requiresTunnelingDecoder) -> {
            List<MediaCodecInfo> all = MediaCodecUtil.getDecoderInfos(
                mimeType, requiresSecureDecoder, requiresTunnelingDecoder);
            List<MediaCodecInfo> filtered = new ArrayList<>();
            for (MediaCodecInfo info : all) {
                if (!isBlocklisted(info.name)) {
                    filtered.add(info);
                } else {
                    android.util.Log.d("QtiBlocklist", "Blocked: " + info.name);
                }
            }
            if (filtered.isEmpty()) return all;
            android.util.Log.d("QtiBlocklist", "Using: " + filtered.get(0).name);
            return filtered;
        };
    }

    private static boolean isBlocklisted(String name) {
        if (name == null) return false;
        String lower = name.toLowerCase();
        for (String b : BLOCKLISTED) {
            if (lower.equals(b.toLowerCase())) return true;
        }
        return false;
    }
}`;

const PATCH_JAVA = `package ${PACKAGE}.decoder;

import android.content.Context;
import android.util.Log;
import com.google.android.exoplayer2.DefaultRenderersFactory;
import com.google.android.exoplayer2.mediacodec.MediaCodecSelector;

public class VideoManagerPatch {

    private static final String TAG = "VideoManagerPatch";
    private static boolean applied = false;

    public static void apply(Context context) {
        if (applied) return;
        applied = true;
        try {
            MediaCodecSelector selector = QtiDecoderBlocklist.buildSelector();
            java.lang.reflect.Field field = DefaultRenderersFactory.class
                .getDeclaredField("DEFAULT_MEDIA_CODEC_SELECTOR");
            field.setAccessible(true);
            field.set(null, selector);
            Log.d(TAG, "QTI decoder blocklist applied");
        } catch (Exception e) {
            Log.d(TAG, "Fallback: " + e.getMessage());
            context.getApplicationContext()
                .getSharedPreferences("qti_patch", Context.MODE_PRIVATE)
                .edit().putBoolean("enabled", true).apply();
        }
    }
}`;

const withQtiDecoderFix = (config) => {
    return withDangerousMod(config, [
        'android',
        async (config) => {
            const root = config.modRequest.projectRoot;

            const decoderDir = path.join(
                root, 'android', 'app', 'src', 'main', 'java',
                PACKAGE_PATH, 'decoder'
            );
            fs.mkdirSync(decoderDir, { recursive: true });
            fs.writeFileSync(path.join(decoderDir, 'QtiDecoderBlocklist.java'), BLOCKLIST_JAVA);
            fs.writeFileSync(path.join(decoderDir, 'VideoManagerPatch.java'), PATCH_JAVA);
            console.log('✅ [QtiDecoderFix] Java files written to', decoderDir);

            const ktPath   = path.join(root, 'android', 'app', 'src', 'main', 'java', PACKAGE_PATH, 'MainApplication.kt');
            const javaPath = path.join(root, 'android', 'app', 'src', 'main', 'java', PACKAGE_PATH, 'MainApplication.java');

            const mainAppPath = fs.existsSync(ktPath) ? ktPath
                              : fs.existsSync(javaPath) ? javaPath
                              : null;

            if (!mainAppPath) {
                console.warn('⚠️ [QtiDecoderFix] MainApplication not found — skipping patch');
                return config;
            }

            const isKotlin = mainAppPath.endsWith('.kt');
            let src = fs.readFileSync(mainAppPath, 'utf8');

            if (isKotlin) {
                const importLine = `import ${PACKAGE}.decoder.VideoManagerPatch`;
                if (!src.includes(importLine)) {
                    src = src.replace(/^(package .+)$/m, `$1\n\n${importLine}`);
                    console.log('✅ [QtiDecoderFix] Import added to MainApplication.kt');
                }
                const applyCall = `VideoManagerPatch.apply(this)`;
                if (!src.includes(applyCall)) {
                    src = src.replace(/super\.onCreate\(\)/, `super.onCreate()\n    ${applyCall}`);
                    console.log('✅ [QtiDecoderFix] VideoManagerPatch.apply(this) added to onCreate()');
                }
            } else {
                const importLine = `import ${PACKAGE}.decoder.VideoManagerPatch;`;
                if (!src.includes(importLine)) {
                    src = src.replace(/^(package .+;)/m, `$1\n\n${importLine}`);
                    console.log('✅ [QtiDecoderFix] Import added to MainApplication.java');
                }
                const applyCall = `VideoManagerPatch.apply(this);`;
                if (!src.includes(applyCall)) {
                    src = src.replace(/super\.onCreate\(\);/, `super.onCreate();\n    ${applyCall}`);
                    console.log('✅ [QtiDecoderFix] VideoManagerPatch.apply(this) added to onCreate()');
                }
            }

            fs.writeFileSync(mainAppPath, src);
            console.log('✅ [QtiDecoderFix] MainApplication patched successfully');

            return config;
        },
    ]);
};

module.exports = withQtiDecoderFix;