import { Controller, Post, HttpCode } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { RustRuntimeProvider } from '../runtime/rust-runtime.provider';

@ApiTags('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly rustRuntime: RustRuntimeProvider) {}

  @Post('circuit-breaker/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Manually reset the circuit breaker to CLOSED state.' })
  resetCircuitBreaker() {
    this.rustRuntime.resetCircuitBreaker();
    return { status: 'ok', state: 'CLOSED' };
  }
}
