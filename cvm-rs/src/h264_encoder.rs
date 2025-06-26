use ffmpeg_next::{codec, encoder, format, frame, software, util};
use ffmpeg_next::util::format::pixel::Pixel;
use ffmpeg_next::util::rational::Rational;

pub struct Image<'a> {
    pub buffer: &'a [u8],
    pub width: u32,
    pub height: u32,
    pub stride: u32,
}

pub struct H264Encoder {
    context: encoder::video::Video,
    scaler: software::scaling::Context,
}

impl H264Encoder {
    pub fn new(width: u32, height: u32, bitrate: u32) -> Self {
        ffmpeg_next::init().unwrap();

        let codec = codec::encoder::find(codec::Id::H264).unwrap();
        let mut context = codec
            .video()
            .unwrap()
            .configure()
            .width(width as i32)
            .height(height as i32)
            .bit_rate(bitrate as i64)
            .frame_rate(Some(Rational(30, 1)))
            .pixel_format(Pixel::YUV420P)
            .open()
            .unwrap();

        let scaler = software::scaling::Context::get(
            Pixel::RGBA,
            width as i32,
            height as i32,
            Pixel::YUV420P,
            width as i32,
            height as i32,
            software::scaling::Flags::BILINEAR,
        )
        .unwrap();

        Self { context, scaler }
    }

    pub fn encode_frame(&mut self, image: &Image) -> Vec<u8> {
        let mut input = frame::Video::new(Pixel::RGBA, image.width as u32, image.height as u32);
        input.data_mut(0).copy_from_slice(image.buffer);

        let mut output_frame = frame::Video::new(Pixel::YUV420P, image.width, image.height);
        self.scaler.run(&input, &mut output_frame).unwrap();

        let mut packet = codec::packet::Packet::empty();
        self.context.encode(&output_frame, &mut packet).unwrap();

        packet.data().to_vec()
    }
}
