<script type="x-shader/x-vertex" id="vs_r2d2">

	<val js.vs_defines>

	#ifdef IMESH_SELF_SHADOW
		attribute vec3 instanceRGID;	
		varying vec3 vrgID;
	#endif

	varying vec3 vpos;

	void main() {
		vec4 pos = vec4(position, 1.0);
		#ifdef USE_INSTANCING
			pos = instanceMatrix * pos;
		#endif
		vec4 mvpos = modelViewMatrix * pos;
		gl_Position = projectionMatrix * mvpos;
		vpos = mvpos.xyz;

		#ifdef IMESH_SELF_SHADOW
			vrgID = instanceRGID;
		#endif
	}
</script>
<script type="x-shader/x-fragment" id="fs_r2d2">

	<val js.fs_defines>

	#ifdef IMESH_SELF_SHADOW
		varying vec3 vrgID;
	#else
		// .gr = redID, .ab = distance from focal/z==0
		uniform vec2 rgID;
	#endif

	uniform bool persp; // cam type
	uniform float near;
	uniform float fact; 
	varying vec3 vpos;
	void main() {
		float dist = persp ? length(vpos) : abs(vpos.z);
		float twobyte = (dist - near) * fact; // [near,fmax] -> [0,65535]
		vec2 ab;
		ab.x = floor(twobyte / 256.0);
		ab.y = twobyte - ab.x * 256.0;
		ab /= 255.0;
		
		#ifdef IMESH_SELF_SHADOW
			gl_FragColor = vec4(vrgID.yz, ab.yx);
		#else
			gl_FragColor = vec4(rgID, ab.yx);
		#endif
	}
</script>
<script type="x-shader/x-vertex" id="vs_lamb">

	<val js.vs_defines>

	#ifdef IMESH_SELF_SHADOW
		attribute vec3 instanceRGID;	
		varying vec3 vrgID;
	#endif

	#ifdef VPN
		// interpolated world positions and normals
		varying vec3 vpn_pos;
		varying vec3 vpn_nrm;
		// inverse transpose mesh.matrixWorld
		uniform mat3 normMatrix;
	#endif
	
	varying vec2 vuv;
	varying vec3 vColor;

	void main() {
		vec4 pos = vec4(position, 1.0);
		#ifdef USE_INSTANCING
			pos = instanceMatrix * pos;
		#endif
		gl_Position = projectionMatrix * modelViewMatrix * pos;

		#ifdef VPN
			vec3 nrm = vec3(normal);
			#ifdef USE_INSTANCING
				mat3 m = mat3(instanceMatrix);
				nrm /= vec3(dot(m[0], m[0]), dot(m[1], m[1]), dot(m[2], m[2]));
				nrm = m * nrm;
			#endif
			vpn_pos = (modelMatrix * pos).xyz;
			vpn_nrm = normalize(normMatrix * nrm);
		#endif

		vuv = uv;

		#ifdef USE_INSTANCING_COLOR
			vColor = instanceColor;
		#elif defined USE_COLOR
			vColor = color;
		#else
			vColor = vec3(1.0);
		#endif

		#ifdef IMESH_SELF_SHADOW
			vrgID = instanceRGID;
		#endif
	}
</script>
<script type="x-shader/x-function" id="quaternFromVects">
	vec4 quaternFromVects (vec3 v1, vec3 v2) {
		float costh = dot(v1, v2);
		float err = 0.0001;
		if (costh > -1.0 + err) {
			vec4 q = vec4(costh + 1.0, cross(v1, v2));
			return normalize(q);
		} else {
			vec3 aux = vec3(0.0, 0.0, 0.0);
			float min = v1.x;
			int ind = 0;
			if (v1.y < min) { min = v1.y; ind = 1; }
			if (v1.z < min) { min = v1.z; ind = 2; }
			aux[ind] = 1.0;
			vec3 orth = normalize(cross(v1, aux));
			return vec4(0, orth);
		}
	}
</script>
<script type="x-shader/x-function" id="quaternRotate">
	vec3 quaternRotate(vec3 v, vec4 q) { // q[0] = w
		vec3 temp = 2.0 * cross(q.yzw, v);
		return v + q.x * temp + cross(q.yzw, temp);
	}
</script>
<script type="x-shader/x-function" id="readCircle">
	float readCircle(int blur, sampler2D tex, vec4 atl, vec2 uv, vec2 uvpx, float rgID, float depth) {
		float dim = 0.0;
		int beg = rc_bl[blur];
		for(int i = 0; i < rc_bl[blur + 8]; i+=2) {
			int ind = i + beg;
			vec2 pos = uv + vec2(rc_off[ind], rc_off[ind + 1]) * uvpx * 0.5;
			vec4 r2d2 = texture2D(tex, pos * atl.zw + atl.xy);
			float red_id = 256.0 * r2d2.g + r2d2.r;
			float red_depth = 256.0 * r2d2.a + r2d2.b;
			if(abs(red_id - rgID) > 0.002 && red_id > 0.002 && depth > red_depth) 
			dim += 1.0;
		}
		return dim * rc_tot[blur];
	}
</script>
<script type="x-shader/x-function" id="calcShadow">
	float shadMode(float x) {
		if(shad_mode == 0) return 1.0 - x;
		if(shad_mode == 1) return 1.0 + x;
		if(shad_mode == 2) {
			float t = x - 0.5;
			return 2.5 - 6.0 * t * t;
		}
	}

	float calcShadow(vec3 pos, dpLightExt light, sampler2D atlas) {
		vec4 vpos = vec4(pos, 1.0);
		vec4 hmgn = light.projViewMatrix * vpos;
		vec2 tex_ndc = (hmgn / hmgn.w).xy;
		if(abs(tex_ndc.x) <= 1.0 && abs(tex_ndc.y) <= 1.0) {
			vec2 uv = 0.5 * tex_ndc + 0.5;
			vec4 atl = light.atl;
			vec3 pov_pos = (light.iViewMatrix * vpos).xyz;
			float self_depth = (length(pov_pos) - light.cam_near) * light.cam_fact - light.shad_prox;
			int blur = light.shad_blur;
			#ifdef IMESH_SELF_SHADOW
				float perc = readCircle(blur, atlas, atl, uv, light.uvpx, vrgID.x, self_depth);
			#else
				float perc = readCircle(blur, atlas, atl, uv, light.uvpx, rgID, self_depth);
			#endif
			float x = perc * light.shad_str;
			return shadMode(x);
		} else {
			return 1.0;
		}
	}
</script>
<script type="x-shader/x-fragment" id="fs_lamb">

	<val js.fs_defines>

	#ifdef IMESH_SELF_SHADOW
		varying vec3 vrgID;
	#endif

	#ifdef AMBIENT
		struct ambientLight {
			vec3 color;
			float intensity;
		};
		uniform ambientLight<val js.amb.len> amb_light;
	#endif

	#if defined DIRECT && !defined DSHADOW || defined POINT && !defined PSHADOW
		struct dpLight {
			vec3 color;
			vec3 position;
			vec3 lookat;
			float intensity;
			float decay;
		};
	#endif

	#if defined DSHADOW || defined PSHADOW
		struct dpLightExt {
			vec3 color;
			vec3 position;
			vec3 lookat;
			float decay;
			float intensity;

			vec4 atl;
			vec2 uvpx;
			float shad_prox;
			float shad_str;
			int shad_blur;
			float cam_fact;
			float cam_near;
			mat4 iViewMatrix;
			mat4 projViewMatrix;
		};

		uniform float rgID;
		//uniform bool castShadow;
		uniform bool receiveShadow;

		uniform int rc_bl[16];
		uniform float rc_tot[8];
		uniform float rc_off[134];
		#include 'readCircle'

		uniform int shad_mode;
		#include 'calcShadow'
	#endif

	#if defined DSHADOW
		uniform sampler2D atlasD;
		uniform dpLightExt<val js.dir.len> dir_light;
	#elif defined DIRECT
		uniform dpLight<val js.dir.len> dir_light;
	#endif

	#if defined PSHADOW
		uniform sampler2D atlasP;
		uniform dpLightExt<val js.pnt.len> pnt_light;
	#elif defined POINT
		uniform dpLight<val js.pnt.len> pnt_light;
	#endif

	#ifdef VPN
		varying vec3 vpn_pos;
		varying vec3 vpn_nrm;
	#endif

	#ifdef SPECULAR
		struct specular {
			float falloff;
			float strength;
			vec3 position;
		};
		uniform specular spec;
		vec3 mirror(vec3 n, vec3 a) {
			float amp = 2.0 * dot(n, a);
			return amp * n - a;
		}
	#endif

	#ifdef TRANSLUCENT
		uniform float tlucy;
	#endif

	varying vec2 vuv;
	uniform vec3 color;
	
	#ifdef MAP
		uniform sampler2D map;
		#ifdef MAPCTRL
			uniform mat3 mapctrl;
		#endif
		#ifdef MAPMIX
			uniform float mapmix;
		#endif
	#endif

	#if defined BMAP && defined VPN
		uniform float bmfact;
		uniform sampler2D bmap;
		#include 'quaternFromVects'
		#include 'quaternRotate'
	#endif

	#ifdef TEXLIGHT
		struct texLight {
			float s; // rec square plane half-size
			float fov; // off switch
			mat3 texcs;
			#ifdef TLMAPCTRL
				uniform mat3 mapctrl;
			#endif
		};
		uniform texLight<val js.pnt.len> tex_light;
		uniform sampler2D<val js.pnt.len> tlmap;
	#endif

	varying vec3 vColor;

	uniform float gamma;

	<val js?.inject?.before_main>

	void main() {
		vec3 light = vec3(0.0);

		#ifdef VPN
			vec3 pos = vpn_pos;
			vec3 nrm = gl_FrontFacing ? vpn_nrm : -vpn_nrm;
			nrm = normalize(nrm);
		#endif

		#if defined BMAP && defined VPN
			vec2 nuvx = vuv + dFdx(vuv);
			vec2 nuvy = vuv + dFdy(vuv);
			vec3 htex = vec3(
				texture2D(bmap, nuvx).g,
				texture2D(bmap, nuvy).g,
				texture2D(bmap, vuv).g
			);
			vec2 hdif = vec2(htex.x - htex.z, htex.y - htex.z);
			if(abs(hdif.x) > 0.002 || abs(hdif.y) > 0.002) {
				vec3 posdx = dFdx(pos);
				vec3 posdy = dFdy(pos);
				vec3 facenorm = normalize(cross(posdx, posdy));
				vec2 hdifsc = bmfact * hdif;
				vec3 slopedx = posdx + facenorm * hdifsc.x;
				vec3 slopedy = posdy + facenorm * hdifsc.y;
				vec3 slope = normalize(cross(slopedx, slopedy));
				vec4 q = quaternFromVects(facenorm, slope); 
				nrm = quaternRotate(nrm, q);
			}
		#endif

		#ifdef SPECULAR
			vec3 mir_dir = mirror(nrm, normalize(spec.position - pos));
		#endif

		#ifdef AMBIENT
			<val js.amb.for_beg>
			light += <val js.amb.i>.color * <val js.amb.i>.intensity;
			<val js.amb.for_end>
		#endif

		#ifdef DIRECT
			<val js.dir.for_beg>

			vec3 dl_ndir = normalize(<val js.dir.i>.position - <val js.dir.i>.lookat);
			float dl_dot = dot(dl_ndir, nrm);

			#ifdef TRANSLUCENT
				bool dback_side = false;
				if(dl_dot < 0.0) {
					dl_dot = -dl_dot;
					dback_side = true;
				}
			#endif

			float dclm = clamp(dl_dot, 0.0, 1.0);
			
			#ifdef SPECULAR
				dclm += dclm * spec.strength * pow(clamp(dot(mir_dir, dl_ndir), 0.0, 1.0), spec.falloff);
			#endif

			vec3 dlight = dclm * <val js.dir.i>.color * <val js.dir.i>.intensity;

			#ifdef TRANSLUCENT
			if(dback_side) dlight *= tlucy;
			#endif

			#ifdef DSHADOW
				if(receiveShadow && <val js.dir.i>.shad_str > 0.0) {
					float frust_hemi = dot(dl_ndir, <val js.dir.i>.position - pos);
					if(frust_hemi > 0.0) {
						float dim_d = calcShadow(pos, <val js.dir.i>, atlasD);
						dlight *= dim_d;
					}
				}
			#endif

			light += dlight;
			
			<val js.dir.for_end>
		#endif

		#ifdef POINT
		<val js.pnt.for_beg>

			float pl_int = <val js.pnt.i>.intensity;

			#ifdef TEXLIGHT
				if(<val js.ptl.i>.fov > 0.0) {
					mat3 texcs = <val js.ptl.i>.texcs;
					vec2 uv = vec2(dot(pos, texcs[0]), dot(pos, texcs[1])) - texcs[2].xy;
					#ifdef TLMAPCTRL
						//uv = (<val js.ptl.i>.mapctrl * vec3(uv, 1.0)).xy;
					#endif
					vec2 mid_uv = uv * <val js.ptl.i>.s;

					vec4 duv = vec4(dFdx(mid_uv), dFdy(mid_uv));
					pl_int = abs(mid_uv.x) > 0.49 || abs(mid_uv.y) > 0.49 ? 0.0 : 
						pl_int * textureGrad(<val js.tlm.i>, mid_uv + 0.5, duv.xy, duv.zw).g;
				}
			#endif

			if(pl_int > 0.0) {

				float pl_dec = <val js.pnt.i>.decay;
				vec3 pl_dir = <val js.pnt.i>.position - pos;
				vec3 pl_ndir = normalize(pl_dir);
				float pl_dot = dot(pl_ndir, nrm);

				#ifdef TRANSLUCENT
					bool pback_side = false;
					if(pl_dot < 0.0) {
						pl_dot = -pl_dot;
						pback_side = true;
					}
				#endif

				float pclm = clamp(pl_dot, 0.0, 1.0);
				
				#ifdef SPECULAR
					pclm += pclm * spec.strength * pow(clamp(dot(mir_dir, pl_ndir), 0.0, 1.0), spec.falloff);
				#endif
				
				vec3 plight = pclm * <val js.pnt.i>.color * pl_int;

				if(pl_dec != 0.0) plight *= pow(length(pl_dir), -pl_dec);

				#ifdef TRANSLUCENT
					if(pback_side) plight *= tlucy;
				#endif

				#ifdef PSHADOW
					if(receiveShadow && <val js.pnt.i>.shad_str > 0.0) {
						float frust_hemi = dot(<val js.pnt.i>.position - <val js.pnt.i>.lookat, pl_ndir);
						if(frust_hemi > 0.0) {
							float dim_p = calcShadow(pos, <val js.pnt.i>, atlasP);
							plight *= dim_p;
						}
					}
				#endif

				light += plight;
			}
		<val js.pnt.for_end>
		#endif

		vec3 rgb = color * vColor;
		#ifdef MAP
			vec2 muv = vuv;

			<val js?.inject?.uvmap>

			#ifdef MAPCTRL
				muv = (mapctrl * vec3(vuv, 1.0)).xy;
			#endif
			#ifdef MAPMIX
				rgb = mix(rgb, texture2D(map, muv).rgb, mapmix);
			#else
				rgb *= texture2D(map, muv).rgb;
			#endif
		#endif
		
		vec3 sRGB = gamma >= 0.0 ? pow(light, vec3(1.0 / gamma)) * rgb : light * rgb;
		
		<val js?.inject?.color_filter>

		gl_FragColor = vec4(sRGB, 1.0);
	}
</script>