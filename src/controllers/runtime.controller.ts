import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppConfigService } from '../config/app-config.service';
import { RuntimeHealthResponseDto } from '../dto/run-responses.dto';
import { RuntimeProviderRegistry } from '../runtime/runtime-provider.registry';

@ApiTags('runtime')
@Controller('runtime')
export class RuntimeController {
  constructor(
    private readonly config: AppConfigService,
    private readonly runtimeRegistry: RuntimeProviderRegistry
  ) {}

  @Get('manifest')
  @ApiOperation({ summary: 'Fetch runtime manifest from the configured runtime provider.' })
  async getManifest() {
    return this.runtimeRegistry.get(this.config.runtimeKind).getManifest();
  }

  @Get('modes')
  @ApiOperation({ summary: 'List runtime-advertised modes.' })
  async listModes() {
    return this.runtimeRegistry.get(this.config.runtimeKind).listModes();
  }

  @Get('roots')
  @ApiOperation({ summary: 'List runtime-advertised roots.' })
  async listRoots() {
    return this.runtimeRegistry.get(this.config.runtimeKind).listRoots();
  }

  @Get('health')
  @ApiOkResponse({ type: RuntimeHealthResponseDto })
  @ApiOperation({ summary: 'Check runtime reachability and manifest availability.' })
  async health() {
    return this.runtimeRegistry.get(this.config.runtimeKind).health();
  }
}
