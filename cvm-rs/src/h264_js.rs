#[napi(object)]
pub struct H264InputArgs {
    pub width: u32,
    pub height: u32,
    pub stride: u32,
    pub buffer: napi::JsBuffer,
    pub bitrate: u32,
}

#[napi(js_name = "h264Encode")]
pub fn h264_encode(env: Env, input: H264InputArgs) -> napi::Result<napi::JsObject> {
    let (deferred, promise) = env.create_deferred::<napi::JsBuffer, _>()?;
    let mut buf = input.buffer.into_ref()?;

    rayon_pool().spawn_fifo(move || {
        let image = Image {
            buffer: &buf,
            width: input.width,
            height: input.height,
            stride: input.stride,
        };

        let mut encoder = H264Encoder::new(input.width, input.height, input.bitrate);
        let data = encoder.encode_frame(&image);

        deferred.resolve(move |env| {
            let buffer = env.create_buffer_with_data(data).expect("failed to create buffer");
            buf.unref(env)?;
            Ok(buffer.into_raw())
        });
    });

    Ok(promise)
}
