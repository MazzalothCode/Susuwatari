import {
  BLEND_MODES,
  Container,
  Graphics,
  Sprite,
  Texture
} from 'pixi.js';
import { DEFAULT_BLOB_LAYOUT, type Particle, type ParticleSystemOptions } from './types';
import { sampleBlobPoseOffsets } from './blobPose';
import { GlyphField } from '../typography/glyphField';
import { blobDisplaySize } from '../assets/blobs/blobMetrics';
import headBlobUrl from '../assets/blobs/head_blob.svg';
import bodyBlobUrl from '../assets/blobs/body_blob.svg';
import tailBaseBlobUrl from '../assets/blobs/tail-base_blob.svg';
import tailMidBlobUrl from '../assets/blobs/tail-mid_blob.svg';
import tailTipBlobUrl from '../assets/blobs/tail-tip_blob.svg';
import faceBlobUrl from '../assets/blobs/face_blob.svg';
import footBlobUrl from '../assets/blobs/foot_blob.svg';

const GUIDE_MIN_POINTS = 18;
const GUIDE_MAX_STEPS = 56;
const BLOB_VISUAL_SCALE = 0.235;

type PointerState = {
  x: number;
  y: number;
  active: boolean;
};

type GuideSample = {
  x: number;
  y: number;
  tx: number;
  ty: number;
};

type ParticleView = {
  haze: Sprite;
  body: Sprite;
  head: Sprite;
  face: Sprite;
  feet: Sprite;
  tailBase: Sprite;
  tailMid: Sprite;
  tailTip: Sprite;
  highlight: Sprite;
};

type ParticleTextures = {
  haze: Texture;
  head: Texture;
  body: Texture;
  face: Texture;
  feet: Texture;
  tailBase: Texture;
  tailMid: Texture;
  tailTip: Texture;
  highlight: Texture;
};

type GuideLoop = {
  points: Array<{ x: number; y: number }>;
  lengths: number[];
  totalLength: number;
};

export class CatParticleSystem {
  private readonly backLayer = new Container();
  private readonly guideLayer = new Container();
  private readonly trailLayer = new Container();
  private readonly headLayer = new Container();
  private readonly guideGraphics = new Graphics();
  private readonly textures: ParticleTextures;
  private readonly views: ParticleView[] = [];
  private particles: Particle[] = [];
  private masterGuides: GuideLoop[] = [];
  private options: ParticleSystemOptions;
  private field: GlyphField;
  private pointer: PointerState = { x: 0, y: 0, active: false };

  constructor(
    private readonly root: Container,
    options: ParticleSystemOptions
  ) {
    this.options = options;
    this.field = new GlyphField(options);
    this.textures = createParticleTextures();

    this.backLayer.sortableChildren = true;
    this.guideLayer.sortableChildren = true;
    this.trailLayer.sortableChildren = true;
    this.headLayer.sortableChildren = true;

    this.guideLayer.addChild(this.guideGraphics);
    this.root.addChild(this.backLayer, this.guideLayer, this.trailLayer, this.headLayer);
    this.reseed();
  }

  setPointer(point: { x: number; y: number } | null) {
    if (!point) {
      this.pointer.active = false;
      return;
    }

    this.pointer = {
      x: point.x,
      y: point.y,
      active: true
    };
  }

  setOptions(nextOptions: Omit<ParticleSystemOptions, 'width' | 'height'>) {
    const layoutChanged =
      nextOptions.glyph !== this.options.glyph ||
      nextOptions.fontFamily !== this.options.fontFamily ||
      nextOptions.fontData !== this.options.fontData ||
      nextOptions.density !== this.options.density;

    this.options = { ...this.options, ...nextOptions };

    if (layoutChanged) {
      this.field = new GlyphField(this.options);
      this.reseed();
      return;
    }

    this.drawGuides();
  }

  resize(width: number, height: number) {
    this.options = { ...this.options, width, height };
    this.field = new GlyphField(this.options);
    this.reseed();
  }

  update(deltaSeconds: number) {
    const dt = Math.min(deltaSeconds, 1 / 20);
    const speedBlend = this.options.speed;
    const flowTempo = 10 + speedBlend * 60;
    const softness = this.options.softness;
    const catScale = this.options.catScale ?? 1;
    const pointerRadius = Math.min(this.options.width, this.options.height) * 0.15;
    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      const previousDisplayX = particle.displayX;
      const previousDisplayY = particle.displayY;
      const baseAdvance = particle.pathSpeed * flowTempo * dt * particle.direction;
      particle.hopPhase += (Math.abs(baseAdvance) / particle.hopStride) * Math.PI * 2;
      const hopWave = shapedHopWave(particle.hopPhase);
      const hopMotion = hopPhaseMotion(particle.hopPhase);
      const hopAccent = Math.sin(particle.hopPhase * 2 + particle.depthPhase * 0.35) * 0.08;
      const depthTarget = clamp(
        particle.depthBase + hopWave * particle.depthRange + hopAccent,
        -1.08,
        1.08
      );
      particle.depthCurrent += (depthTarget - particle.depthCurrent) * (0.082 + softness * 0.024);
      const depthVelocity = Math.abs(particle.depthCurrent - particle.previousDepthCurrent);
      const planeCruise = 1.12 - hopMotion * 0.48;
      const depthCruise = planeCruise - Math.min(0.06, depthVelocity * 1.2);
      particle.pathCursor = wrapDistance(
        particle.pathCursor + baseAdvance * depthCruise,
        particle.guideTotalLength
      );

      const guideSample = sampleGuide(particle, particle.pathCursor);
      const guideNormal = guidePerpendicular(guideSample.tx, guideSample.ty);
      const laneSway = particle.laneAmplitude;
      const depthFloat = particle.depthCurrent * (1.15 + particle.size * 0.03);
      const alongDrift = 0;

      let targetX =
        guideSample.x +
        guideNormal.x * (laneSway + depthFloat) +
        guideSample.tx * alongDrift;
      let targetY =
        guideSample.y +
        guideNormal.y * (laneSway + depthFloat) +
        guideSample.ty * alongDrift;

      if (this.pointer.active) {
        const dx = targetX - this.pointer.x;
        const dy = targetY - this.pointer.y;
        const distance = Math.hypot(dx, dy) || 1;

        if (distance < pointerRadius) {
          const push = (1 - distance / pointerRadius) * (9 + particle.size * 0.28);
          targetX += (dx / distance) * push;
          targetY += (dy / distance) * push;
        }
      }

      particle.displayX += (targetX - particle.displayX) * 0.16;
      particle.displayY += (targetY - particle.displayY) * 0.16;

      const moveX = particle.displayX - previousDisplayX;
      const moveY = particle.displayY - previousDisplayY;
      const moveLength = Math.hypot(moveX, moveY);
      const targetAxisX =
        moveLength > 0.0001 ? moveX / moveLength : guideSample.tx * particle.direction;
      const targetAxisY =
        moveLength > 0.0001 ? moveY / moveLength : guideSample.ty * particle.direction;
      particle.axisX += (targetAxisX - particle.axisX) * 0.18;
      particle.axisY += (targetAxisY - particle.axisY) * 0.18;
      const axisLength = Math.hypot(particle.axisX, particle.axisY) || 1;
      particle.axisX /= axisLength;
      particle.axisY /= axisLength;
      const rearX = -particle.axisX;
      const rearY = -particle.axisY;

      const depthAmount = clamp01((particle.depthCurrent + 1.15) / 2.3);
      const farAmount = 1 - depthAmount;
      const farShell = smoothstep(farAmount);
      const motionHeadScale = (particle.size / 34) * (0.56 + depthAmount * 1.04);
      const headScale = motionHeadScale * BLOB_VISUAL_SCALE * catScale;
      const layout = this.options.blobLayout ?? DEFAULT_BLOB_LAYOUT;
      const postureBlend = computePostureBlend(farAmount);
      const coreScale = coreScaleForDepth(headScale, farShell);
      const headSize = blobDisplaySize('head', coreScale);
      const bodySize = blobDisplaySize('body', coreScale);
      const headExtent = headSize.height;
      const bodyExtent = bodySize.height;
      const poseOffsets = sampleBlobPoseOffsets(layout, postureBlend, headExtent, bodyExtent);
      const bodyDistance = poseOffsets.bodyDistance;
      const bodyX = particle.displayX + rearX * bodyDistance;
      const bodyY = particle.displayY + rearY * bodyDistance;
      const tailRootX = bodyX + rearX * poseOffsets.tailRootDistance;
      const tailRootY = bodyY + rearY * poseOffsets.tailRootDistance;

      particle.tailOrbX += (tailRootX - particle.tailOrbX) * 0.21;
      particle.tailOrbY += (tailRootY - particle.tailOrbY) * 0.21;
      particle.previousDepthCurrent = particle.depthCurrent;
    }

    this.syncViews();
  }

  private reseed() {
    syncViewCount(this.views, this.options.density, this.textures, {
      backLayer: this.backLayer,
      trailLayer: this.trailLayer,
      headLayer: this.headLayer
    });

    const guideCount = clamp(Math.round(this.options.density / 4), 3, 6);
    this.masterGuides = this.buildMasterGuides(guideCount);
    this.drawGuides();

    this.particles = Array.from({ length: this.options.density }, (_, index) => {
      const guide = this.masterGuides[index % this.masterGuides.length];
      const seed = guide.points[index % guide.points.length] ?? this.field.sampleWorldPoint();
      const size = 35;
      const direction = index % 2 === 0 ? 1 : -1;
      const initialCursor =
        wrapDistance(
          (guide.totalLength / Math.max(1, Math.ceil(this.options.density / guideCount))) *
            Math.floor(index / guideCount) +
            Math.random() * 6,
          guide.totalLength
        );
      const initialSample = sampleGuide(
        {
          guidePoints: guide.points,
          guideLengths: guide.lengths,
          guideTotalLength: guide.totalLength
        } as Particle,
        initialCursor
      );
      const normal = guidePerpendicular(initialSample.tx, initialSample.ty);
      const depthBase = (Math.random() * 2 - 1) * 0.08;
      const depthRange = 0.7 + Math.random() * 0.14;
      const hopPhase = Math.random() * Math.PI * 2;
      const hopStride = 96 + Math.random() * 30;
      const lanePhase = Math.random() * Math.PI * 2;
      const laneAmplitude = (Math.random() * 2 - 1) * (0.8 + Math.random() * 1.4);
      const displayX = initialSample.x + normal.x * laneAmplitude;
      const displayY = initialSample.y + normal.y * laneAmplitude;
      const initialAxisX = initialSample.tx * direction;
      const initialAxisY = initialSample.ty * direction;
      const tailCursor = initialCursor - 4.8 * direction;
      const tailSample = sampleGuide(
        {
          guidePoints: guide.points,
          guideLengths: guide.lengths,
          guideTotalLength: guide.totalLength
        } as Particle,
        tailCursor
      );
      const tailNormal = guidePerpendicular(tailSample.tx, tailSample.ty);
      const tailOffset = laneAmplitude * 0.78 + depthBase * 1.1;
      const tailAnchorX = tailSample.x + tailNormal.x * tailOffset;
      const tailAnchorY = tailSample.y + tailNormal.y * tailOffset;

      return {
        guidePoints: guide.points,
        guideLengths: guide.lengths,
        guideTotalLength: guide.totalLength,
        pathCursor: initialCursor,
        pathSpeed: 1,
        size,
        direction,
        lanePhase,
        laneAmplitude,
        driftPhase: Math.random() * Math.PI * 2 + index * 0.03,
        depthBase,
        depthPhase: Math.random() * Math.PI * 2,
        hopPhase,
        hopStride,
        depthRange,
        motionStretch: 0,
        depthCurrent: depthBase,
        previousDepthCurrent: depthBase,
        displayX,
        displayY,
        axisX: initialAxisX,
        axisY: initialAxisY,
        tailOrbX: tailAnchorX,
        tailOrbY: tailAnchorY,
        tailX: tailAnchorX,
        tailY: tailAnchorY
      };
    });
  }

  private buildMasterGuides(count: number) {
    const guides: GuideLoop[] = [];
    const minSpacing = Math.min(this.options.width, this.options.height) * 0.12;
    const seeds: Array<{ x: number; y: number; distance: number }> = [];
    let attempts = 0;

    while (guides.length < count && attempts < count * 24) {
      const seed = this.field.sampleWorldPoint();
      attempts += 1;

      if (seeds.some((point) => distanceBetween(point, seed) < minSpacing)) {
        continue;
      }

      seeds.push(seed);
      const band = clamp(seed.distance * (0.42 + Math.random() * 0.1), -18, -5.4);
      const direction = guides.length % 2 === 0 ? 1 : -1;
      const openGuide = this.buildOpenGuide(seed.x, seed.y, band, direction);

      if (openGuide.points.length < GUIDE_MIN_POINTS) {
        continue;
      }

      const ribbonGuide = this.buildRibbonGuide(
        openGuide.points,
        8 + guides.length * 1.8,
        guides.length * 0.95
      );
      guides.push({
        points: ribbonGuide.points,
        lengths: ribbonGuide.lengths,
        totalLength: ribbonGuide.totalLength
      });
    }

    if (guides.length === 0) {
      const fallback = this.field.sampleWorldPoint();
      const openGuide = this.buildOpenGuide(fallback.x, fallback.y, -8, 1);
      const ribbonGuide = this.buildRibbonGuide(openGuide.points, 10, 0);
      guides.push({
        points: ribbonGuide.points,
        lengths: ribbonGuide.lengths,
        totalLength: ribbonGuide.totalLength
      });
    }

    return guides;
  }

  private buildOpenGuide(seedX: number, seedY: number, band: number, direction: 1 | -1) {
    const stepLength = Math.max(8.5, Math.min(this.options.width, this.options.height) / 64);
    const forward = this.traceGuide(seedX, seedY, band, direction, stepLength);
    const backward = this.traceGuide(seedX, seedY, band, (direction * -1) as 1 | -1, stepLength);
    let points = [...backward.reverse().slice(0, -1), ...forward];

    if (points.length < GUIDE_MIN_POINTS) {
      points = createOrbitFallback(seedX, seedY, stepLength * 2.4, stepLength * 1.6);
    }

    points = smoothPoints(points, 16);

    const measured = measurePath(points);

    return {
      points,
      lengths: measured.lengths,
      totalLength: Math.max(1, measured.total)
    };
  }

  private buildRibbonGuide(
    points: Array<{ x: number; y: number }>,
    offsetAmount: number,
    wavePhase: number
  ) {
    const outerBase = smoothPoints(points, 8);
    const outer = outerBase.map((point, index, array) => {
      const prev = array[Math.max(0, index - 1)] ?? point;
      const next = array[Math.min(array.length - 1, index + 1)] ?? point;
      const tangent = normalize({
        x: next.x - prev.x,
        y: next.y - prev.y
      });
      const normal = { x: -tangent.y, y: tangent.x };
      const progress = array.length <= 1 ? 0 : index / (array.length - 1);
      const wave =
        Math.sin(progress * Math.PI * 4 + wavePhase) * offsetAmount * 0.18 +
        Math.sin(progress * Math.PI * 8 + wavePhase * 0.7) * offsetAmount * 0.06;

      return {
        x: clamp(point.x + normal.x * wave, 0, this.options.width),
        y: clamp(point.y + normal.y * wave, 0, this.options.height)
      };
    });
    const inner = outer.map((point) => {
      const sample = this.field.sample(point.x, point.y);
      return {
        x: clamp(point.x + sample.normalX * offsetAmount * 0.72, 0, this.options.width),
        y: clamp(point.y + sample.normalY * offsetAmount * 0.72, 0, this.options.height)
      };
    });

    const endBridge = buildRoundedCap(
      outer[outer.length - 2] ?? outer[outer.length - 1],
      outer[outer.length - 1],
      inner[inner.length - 1],
      inner[inner.length - 2] ?? inner[inner.length - 1],
      6
    );
    const startBridge = buildRoundedCap(
      inner[1] ?? inner[0],
      inner[0],
      outer[0],
      outer[1] ?? outer[0],
      6
    );
    const loop = [
      ...outer,
      ...endBridge,
      ...inner.slice().reverse(),
      ...startBridge,
      outer[0]
    ];
    const smoothed = smoothPoints(loop, 14);
    const measured = measurePath(smoothed);

    return {
      points: smoothed,
      lengths: measured.lengths,
      totalLength: Math.max(1, measured.total)
    };
  }

  private traceGuide(
    startX: number,
    startY: number,
    band: number,
    direction: 1 | -1,
    stepLength: number
  ) {
    const points = [{ x: startX, y: startY }];
    let x = startX;
    let y = startY;
    let prevTx = 0;
    let prevTy = 0;

    for (let step = 0; step < GUIDE_MAX_STEPS; step += 1) {
      const sample = this.field.sample(x, y);
      let tx = sample.tangentX * direction;
      let ty = sample.tangentY * direction;

      if (prevTx !== 0 || prevTy !== 0) {
        const dot = tx * prevTx + ty * prevTy;
        if (dot < 0) {
          tx *= -1;
          ty *= -1;
        }
      }

      const bandError = sample.distance - band;
      if (prevTx !== 0 || prevTy !== 0) {
        tx = prevTx * 0.7 + tx * 0.3;
        ty = prevTy * 0.7 + ty * 0.3;
        const smoothedMagnitude = Math.hypot(tx, ty) || 1;
        tx /= smoothedMagnitude;
        ty /= smoothedMagnitude;
      }

      const steer = -bandError * 0.11;
      x += tx * stepLength + sample.normalX * steer;
      y += ty * stepLength + sample.normalY * steer;

      x = clamp(x, 0, this.options.width);
      y = clamp(y, 0, this.options.height);

      const nextSample = this.field.sample(x, y);
      if (!nextSample.inside && Math.abs(nextSample.distance) > stepLength * 1.25) {
        break;
      }

      points.push({ x, y });

      if (step > 20 && distanceBetween({ x, y }, { x: startX, y: startY }) < stepLength * 1.4) {
        break;
      }

      prevTx = tx;
      prevTy = ty;
    }

    return points;
  }

  private syncViews() {
    const softness = this.options.softness;
    const catScale = this.options.catScale ?? 1;
    const softMix = smoothstep(clamp01((softness - 0.22) / 0.78));

    for (let index = 0; index < this.particles.length; index += 1) {
      const particle = this.particles[index];
      const view = this.views[index];
      const depthAmount = clamp01((particle.depthCurrent + 1.15) / 2.3);
      const farAmount = 1 - depthAmount;
      const farShell = smoothstep(farAmount);
      const motionHeadScale = (particle.size / 34) * (0.56 + depthAmount * 1.04);
      const headScale = motionHeadScale * BLOB_VISUAL_SCALE * catScale;
      const hazeScale = headScale * (1.12 + softness * 0.1 + farShell * 0.18 + softMix * 0.46);
      const highlightScale = headScale * (1.02 + farShell * 0.2 + softMix * 0.18);
      const hazeShade = shadeToTint(255);
      const layout = this.options.blobLayout ?? DEFAULT_BLOB_LAYOUT;
      const postureBlend = computePostureBlend(farAmount);
      const frontX = particle.axisX;
      const frontY = particle.axisY;
      const rearX = -frontX;
      const rearY = -frontY;
      const bodyRotation = Math.atan2(rearX, -rearY);
      view.haze.position.set(particle.displayX, particle.displayY);
      view.haze.scale.set(hazeScale, hazeScale);
      view.haze.alpha = 0.02 + farShell * 0.07 + softMix * 0.1;
      view.haze.tint = hazeShade;
      view.haze.zIndex = depthAmount;

      const coreScale = coreScaleForDepth(headScale, farShell);
      const headSize = blobDisplaySize('head', coreScale);
      const bodySize = blobDisplaySize('body', coreScale);
      const faceSize = blobDisplaySize('face', coreScale);
      const feetSize = blobDisplaySize('feet', coreScale);
      const tailBaseSize = blobDisplaySize('tailBase', coreScale);
      const tailMidSize = blobDisplaySize('tailMid', coreScale);
      const tailTipSize = blobDisplaySize('tailTip', coreScale);
      const headExtent = headSize.height;
      const bodyExtent = bodySize.height;
      const poseOffsets = sampleBlobPoseOffsets(layout, postureBlend, headExtent, bodyExtent);
      const bodyDistance = poseOffsets.bodyDistance;
      const bodyX = particle.displayX + rearX * bodyDistance;
      const bodyY = particle.displayY + rearY * bodyDistance;

      view.body.position.set(bodyX, bodyY);
      setSpriteDisplaySize(view.body, bodySize.width, bodySize.height);
      view.body.rotation = bodyRotation;
      view.body.alpha = 1;
      view.body.tint = 0xffffff;
      view.body.zIndex = depthAmount + 0.0092;

      view.head.position.set(particle.displayX, particle.displayY);
      setSpriteDisplaySize(view.head, headSize.width, headSize.height);
      view.head.rotation = bodyRotation;
      view.head.alpha = 1;
      view.head.tint = 0xffffff;
      view.head.zIndex = depthAmount + 0.01;

      const faceLead = poseOffsets.faceLead;
      view.face.position.set(
        particle.displayX + frontX * faceLead,
        particle.displayY + frontY * faceLead
      );
      setSpriteDisplaySize(view.face, faceSize.width, faceSize.height);
      view.face.rotation = bodyRotation;
      view.face.alpha = 1;
      view.face.tint = 0xffffff;
      view.face.zIndex = depthAmount + 0.0105;

      const feetLead = poseOffsets.feetLead;
      view.feet.position.set(
        particle.displayX + frontX * feetLead,
        particle.displayY + frontY * feetLead
      );
      setSpriteDisplaySize(view.feet, feetSize.width, feetSize.height);
      view.feet.rotation = bodyRotation;
      view.feet.alpha = 1;
      view.feet.tint = 0xffffff;
      view.feet.zIndex = depthAmount + 0.0068;

      const tailRootX = bodyX + rearX * poseOffsets.tailRootDistance;
      const tailRootY = bodyY + rearY * poseOffsets.tailRootDistance;
      const sideX = -rearY;
      const sideY = rearX;
      const tailBaseX =
        tailRootX + rearX * poseOffsets.tailBaseDistance + sideX * poseOffsets.tailBaseSide;
      const tailBaseY =
        tailRootY + rearY * poseOffsets.tailBaseDistance + sideY * poseOffsets.tailBaseSide;
      const tailMidX =
        tailRootX + rearX * poseOffsets.tailMidDistance + sideX * poseOffsets.tailMidSide;
      const tailMidY =
        tailRootY + rearY * poseOffsets.tailMidDistance + sideY * poseOffsets.tailMidSide;
      const tailTipDrivenX =
        tailRootX + rearX * poseOffsets.tailTipDistance + sideX * poseOffsets.tailTipSide;
      const tailTipDrivenY =
        tailRootY + rearY * poseOffsets.tailTipDistance + sideY * poseOffsets.tailTipSide;
      view.tailBase.position.set(tailBaseX, tailBaseY);
      setSpriteDisplaySize(view.tailBase, tailBaseSize.width, tailBaseSize.height);
      view.tailBase.rotation = bodyRotation;
      view.tailBase.alpha = 1;
      view.tailBase.tint = 0xffffff;
      view.tailBase.zIndex = depthAmount + 0.0086;

      view.tailMid.position.set(tailMidX, tailMidY);
      setSpriteDisplaySize(view.tailMid, tailMidSize.width, tailMidSize.height);
      view.tailMid.rotation = bodyRotation;
      view.tailMid.alpha = 1;
      view.tailMid.tint = 0xffffff;
      view.tailMid.zIndex = depthAmount + 0.00855;

      view.tailTip.position.set(tailTipDrivenX, tailTipDrivenY);
      setSpriteDisplaySize(view.tailTip, tailTipSize.width, tailTipSize.height);
      view.tailTip.rotation = bodyRotation;
      view.tailTip.alpha = 1;
      view.tailTip.tint = 0xffffff;
      view.tailTip.zIndex = depthAmount + 0.0085;

      view.highlight.position.set(
        particle.displayX,
        particle.displayY
      );
      view.highlight.scale.set(
        highlightScale * (1.02 + farShell * 0.14 + softMix * 0.22),
        highlightScale * (1.02 + farShell * 0.14 + softMix * 0.22)
      );
      view.highlight.alpha = 0.024 + farShell * 0.07 + softMix * 0.05;
      view.highlight.tint = shadeToTint(255);
      view.highlight.zIndex = depthAmount + 0.02;
    }
  }

  private drawGuides() {
    this.guideGraphics.clear();
    this.guideLayer.visible = Boolean(this.options.showGuides);

    if (!this.options.showGuides) {
      return;
    }

    this.guideGraphics.lineStyle(1.2, 0xb8c7d9, 0.9);

    for (const guide of this.masterGuides) {
      if (guide.points.length < 2) {
        continue;
      }

      const sampleCount = 220;
      const first = sampleGuide(
        {
          guidePoints: guide.points,
          guideLengths: guide.lengths,
          guideTotalLength: guide.totalLength
        },
        0
      );
      this.guideGraphics.moveTo(first.x, first.y);
      for (let index = 1; index <= sampleCount; index += 1) {
        const sample = sampleGuide(
          {
            guidePoints: guide.points,
            guideLengths: guide.lengths,
            guideTotalLength: guide.totalLength
          },
          (guide.totalLength * index) / sampleCount
        );
        this.guideGraphics.lineTo(sample.x, sample.y);
      }
    }
  }
}

function setSpriteDisplaySize(sprite: Sprite, width: number, height: number) {
  sprite.width = width;
  sprite.height = height;
}

function syncViewCount(
  views: ParticleView[],
  targetCount: number,
  textures: ParticleTextures,
  layers: {
    backLayer: Container;
    trailLayer: Container;
    headLayer: Container;
  }
) {
  while (views.length < targetCount) {
    const haze = new Sprite(textures.haze);
    haze.anchor.set(0.5);

    const body = new Sprite(textures.body);
    body.anchor.set(0.5);

    const head = new Sprite(textures.head);
    head.anchor.set(0.5);

    const face = new Sprite(textures.face);
    face.anchor.set(0.5);

    const feet = new Sprite(textures.feet);
    feet.anchor.set(0.5);

    const tailBase = new Sprite(textures.tailBase);
    tailBase.anchor.set(0.5);

    const tailMid = new Sprite(textures.tailMid);
    tailMid.anchor.set(0.5);

    const tailTip = new Sprite(textures.tailTip);
    tailTip.anchor.set(0.5);

    const highlight = new Sprite(textures.highlight);
    highlight.anchor.set(0.5);
    highlight.blendMode = BLEND_MODES.NORMAL;

    layers.backLayer.addChild(haze);
    layers.trailLayer.addChild(tailTip, tailMid, tailBase);
    layers.headLayer.addChild(feet, body, head, face, highlight);
    views.push({ haze, body, head, face, feet, tailBase, tailMid, tailTip, highlight });
  }

  while (views.length > targetCount) {
    const view = views.pop();

    if (!view) {
      break;
    }

    view.haze.destroy();
    view.body.destroy();
    view.head.destroy();
    view.face.destroy();
    view.feet.destroy();
    view.tailBase.destroy();
    view.tailMid.destroy();
    view.tailTip.destroy();
    view.highlight.destroy();
  }
}

function createParticleTextures(): ParticleTextures {
  return {
    haze: createHazeTexture(),
    head: Texture.from(headBlobUrl),
    body: Texture.from(bodyBlobUrl),
    face: Texture.from(faceBlobUrl),
    feet: Texture.from(footBlobUrl),
    tailBase: Texture.from(tailBaseBlobUrl),
    tailMid: Texture.from(tailMidBlobUrl),
    tailTip: Texture.from(tailTipBlobUrl),
    highlight: createHighlightTexture(),
  };
}

function createHazeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 160;
  canvas.height = 160;
  const context = canvas.getContext('2d');

  if (!context) {
    return Texture.EMPTY;
  }

  const gradient = context.createRadialGradient(80, 80, 22, 80, 80, 76);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.5, 'rgba(255,255,255,0.04)');
  gradient.addColorStop(0.78, 'rgba(255,255,255,0.12)');
  gradient.addColorStop(0.96, 'rgba(255,255,255,0.26)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.beginPath();
  context.arc(80, 80, 72, 0, Math.PI * 2);
  context.fill();

  return Texture.from(canvas);
}

function createHighlightTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 96;
  canvas.height = 96;
  const context = canvas.getContext('2d');

  if (!context) {
    return Texture.EMPTY;
  }

  const gradient = context.createRadialGradient(48, 48, 8, 48, 48, 36);
  gradient.addColorStop(0, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.56, 'rgba(255,255,255,0)');
  gradient.addColorStop(0.72, 'rgba(255,255,255,0.06)');
  gradient.addColorStop(0.84, 'rgba(255,255,255,0.46)');
  gradient.addColorStop(0.94, 'rgba(255,255,255,1)');
  gradient.addColorStop(1, 'rgba(255,255,255,0)');
  context.fillStyle = gradient;
  context.filter = 'blur(8px)';
  context.beginPath();
  context.arc(48, 48, 34, 0, Math.PI * 2);
  context.fill();
  context.filter = 'none';

  return Texture.from(canvas);
}

function shapedHopWave(phase: number) {
  const sine = Math.sin(phase);
  const triangle = (2 / Math.PI) * Math.asin(sine);
  return triangle * 0.74 + sine * 0.26;
}

function hopPhaseMotion(phase: number) {
  const epsilon = 0.02;
  const prev = shapedHopWave(phase - epsilon);
  const next = shapedHopWave(phase + epsilon);
  return clamp01(Math.abs((next - prev) / (epsilon * 2)) * 0.7);
}

function smoothstep(value: number) {
  const clamped = clamp01(value);
  return clamped * clamped * (3 - 2 * clamped);
}

function computePostureBlend(farAmount: number) {
  return smoothstep(clamp01(farAmount));
}

function coreScaleForDepth(headScale: number, farShell: number) {
  return headScale * (1 - farShell * 0.14);
}

function sampleGuide(
  particle: Pick<Particle, 'guidePoints' | 'guideLengths' | 'guideTotalLength'>,
  cursor: number
): GuideSample {
  const totalLength = Math.max(1, particle.guideTotalLength);
  const distance = wrapDistance(cursor, totalLength);
  const lastSegment = particle.guidePoints.length - 1;

  for (let index = 0; index < lastSegment; index += 1) {
    const start = particle.guideLengths[index];
    const end = particle.guideLengths[index + 1];

    if (distance > end && index < lastSegment - 1) {
      continue;
    }

    const segmentLength = Math.max(0.0001, end - start);
    const t = clamp01((distance - start) / segmentLength);
    const p0 = particle.guidePoints[wrapIndex(index - 1, particle.guidePoints.length)];
    const p1 = particle.guidePoints[index];
    const p2 = particle.guidePoints[index + 1];
    const p3 = particle.guidePoints[wrapIndex(index + 2, particle.guidePoints.length)];
    const x = catmullRom(p0.x, p1.x, p2.x, p3.x, t);
    const y = catmullRom(p0.y, p1.y, p2.y, p3.y, t);
    const dx = catmullRomTangent(p0.x, p1.x, p2.x, p3.x, t);
    const dy = catmullRomTangent(p0.y, p1.y, p2.y, p3.y, t);
    const magnitude = Math.hypot(dx, dy) || 1;

    return {
      x,
      y,
      tx: dx / magnitude,
      ty: dy / magnitude
    };
  }

  const fallbackCurrent = particle.guidePoints[lastSegment - 1] ?? particle.guidePoints[0];
  const fallbackNext = particle.guidePoints[lastSegment] ?? particle.guidePoints[0];
  const fallbackLength = Math.hypot(
    fallbackNext.x - fallbackCurrent.x,
    fallbackNext.y - fallbackCurrent.y
  ) || 1;

  return {
    x: fallbackNext.x,
    y: fallbackNext.y,
    tx: (fallbackNext.x - fallbackCurrent.x) / fallbackLength,
    ty: (fallbackNext.y - fallbackCurrent.y) / fallbackLength
  };
}

function guidePerpendicular(tx: number, ty: number) {
  const magnitude = Math.hypot(tx, ty) || 1;
  return {
    x: -ty / magnitude,
    y: tx / magnitude
  };
}

function smoothPoints(points: Array<{ x: number; y: number }>, passes: number) {
  let nextPoints = points.slice();

  for (let pass = 0; pass < passes; pass += 1) {
    nextPoints = nextPoints.map((point, index, array) => {
      if (index === 0 || index === array.length - 1) {
        return point;
      }

      const prev = array[index - 1];
      const next = array[index + 1];

      return {
        x: (prev.x + point.x * 2 + next.x) * 0.25,
        y: (prev.y + point.y * 2 + next.y) * 0.25
      };
    });
  }

  return nextPoints;
}

function measurePath(points: Array<{ x: number; y: number }>) {
  const lengths = [0];
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetween(points[index - 1], points[index]);
    lengths.push(total);
  }

  return { lengths, total };
}

function createOrbitFallback(cx: number, cy: number, radiusX: number, radiusY: number) {
  return Array.from({ length: 28 }, (_, index) => {
    const angle = (index / 27) * Math.PI * 2;
    return {
      x: cx + Math.cos(angle) * radiusX,
      y: cy + Math.sin(angle) * radiusY
    };
  });
}

function bridgePoints(from: { x: number; y: number }, to: { x: number; y: number }, count: number) {
  return Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / (count + 1);
    return {
      x: lerp(from.x, to.x, t),
      y: lerp(from.y, to.y, t)
    };
  });
}

function buildRoundedCap(
  outerPrev: { x: number; y: number },
  outerEnd: { x: number; y: number },
  innerEnd: { x: number; y: number },
  innerNext: { x: number; y: number },
  count: number
) {
  const outerTangent = normalize({
    x: outerEnd.x - outerPrev.x,
    y: outerEnd.y - outerPrev.y
  });
  const innerTangent = normalize({
    x: innerNext.x - innerEnd.x,
    y: innerNext.y - innerEnd.y
  });
  const span = distanceBetween(outerEnd, innerEnd);
  const averageTangent = normalize({
    x: outerTangent.x + innerTangent.x,
    y: outerTangent.y + innerTangent.y
  });
  const controlA = {
    x: outerEnd.x + averageTangent.x * span * 0.55,
    y: outerEnd.y + averageTangent.y * span * 0.55
  };
  const controlB = {
    x: innerEnd.x + averageTangent.x * span * 0.55,
    y: innerEnd.y + averageTangent.y * span * 0.55
  };

  return Array.from({ length: count }, (_, index) => {
    const t = (index + 1) / (count + 1);
    return cubicPoint(outerEnd, controlA, controlB, innerEnd, t);
  });
}

function distanceBetween(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function wrapIndex(index: number, length: number) {
  if (length <= 0) {
    return 0;
  }

  return ((index % length) + length) % length;
}

function wrapDistance(value: number, total: number) {
  if (total <= 0) {
    return 0;
  }

  return ((value % total) + total) % total;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function clamp01(value: number) {
  return clamp(value, 0, 1);
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;
  const t3 = t2 * t;

  return (
    0.5 *
    ((2 * p1) +
      (-p0 + p2) * t +
      (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
      (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
  );
}

function catmullRomTangent(p0: number, p1: number, p2: number, p3: number, t: number) {
  const t2 = t * t;

  return (
    0.5 *
    ((-p0 + p2) +
      2 * (2 * p0 - 5 * p1 + 4 * p2 - p3) * t +
      3 * (-p0 + 3 * p1 - 3 * p2 + p3) * t2)
  );
}

function cubicPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number },
  t: number
) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;

  return {
    x: mt2 * mt * p0.x + 3 * mt2 * t * p1.x + 3 * mt * t2 * p2.x + t2 * t * p3.x,
    y: mt2 * mt * p0.y + 3 * mt2 * t * p1.y + 3 * mt * t2 * p2.y + t2 * t * p3.y
  };
}

function normalize(vector: { x: number; y: number }) {
  const magnitude = Math.hypot(vector.x, vector.y) || 1;
  return {
    x: vector.x / magnitude,
    y: vector.y / magnitude
  };
}

function shadeToTint(shade: number) {
  const channel = clamp(Math.round(shade), 0, 255);
  return (channel << 16) | (channel << 8) | channel;
}
